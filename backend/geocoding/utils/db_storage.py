"""Database storage utilities for geodata."""

import logging
from typing import Dict, Optional
import sqlite3
import os
from math import cos, radians

logger = logging.getLogger(__name__)


class DBStorage:
    """Database storage utilities for geodata."""
    
    def __init__(self, geocoding_db_path: str = None):
        # Use provided path or fallback to default location
        if geocoding_db_path:
            self.db_path = geocoding_db_path
        else:
            # Import config here to avoid circular imports
            try:
                from config import config
                self.db_path = config.geocoding_db_path
            except ImportError:
                # Fallback to hardcoded path if config not available
                self.db_path = os.path.join(os.path.dirname(__file__), "../../../data/geocoding_offline.db")
    
    async def store_geodata_in_db(self, geodata: Dict, trip_id: str, waypoint: Dict):
        """Store geodata in the offline geocoding database"""
        return await store_geodata_in_db(geodata, trip_id, waypoint)
    
    async def is_available(self) -> bool:
        """Check if the offline database is available"""
        try:
            # Check if database file exists
            if not os.path.exists(self.db_path):
                logger.warning(f"Database file not found: {self.db_path}")
                return False
            
            # Try to connect and check if it has tables
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = cursor.fetchall()
                return len(tables) > 0
                
        except Exception as e:
            logger.error(f"Error checking database availability: {str(e)}")
            return False
    
    async def get_record_count(self) -> int:
        """Get the total number of records in the offline database"""
        try:
            if not await self.is_available():
                return 0
                
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                # Try common table names for geocoding data
                for table_name in ['cities', 'locations', 'geocoding_data', 'places']:
                    try:
                        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                        count = cursor.fetchone()[0]
                        if count > 0:
                            return count
                    except sqlite3.OperationalError:
                        continue
                
                # If no specific table found, count all tables
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = cursor.fetchall()
                total_count = 0
                for (table_name,) in tables:
                    try:
                        cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                        count = cursor.fetchone()[0]
                        total_count += count
                    except sqlite3.OperationalError:
                        continue
                
                return total_count
                
        except Exception as e:
            logger.error(f"Error getting record count: {str(e)}")
            return 0
    
    async def reverse_geocode(self, lat: float, lon: float, radius_km: float = 1.0) -> Optional[Dict]:
        """Perform reverse geocoding using offline database"""
        try:
            if not await self.is_available():
                return None
            
            # Try to use the offline geo manager if available
            try:
                from main import offline_geo_manager
                if offline_geo_manager and hasattr(offline_geo_manager, 'offline_db'):
                    result = offline_geo_manager.offline_db.get_location(lat, lon)
                    if result:
                        return {
                            "name": result.city or "Unknown",
                            "admin1": result.state or "",
                            "admin2": result.country or "",
                            "cc": result.country_code or "",
                            "distance": 0,  # Distance not available from this method
                            "source": "offline_database"
                        }
            except ImportError:
                logger.debug("Offline geo manager not available")
            
            # Fallback: direct database query
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Calculate approximate distance bounds
                lat_range = radius_km / 111.32  # Approximate km per degree latitude
                lon_range = radius_km / (111.32 * abs(cos(radians(lat))))  # Adjust for longitude
                
                # Get table names to know what we're working with
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = [row[0] for row in cursor.fetchall()]
                logger.debug(f"Available tables in offline DB: {tables}")
                
                # Try different possible table structures based on what exists
                queries_to_try = []
                
                # First try our detailed_geocoding table if it exists
                if 'detailed_geocoding' in tables:
                    queries_to_try.append({
                        'query': """
                        SELECT 
                            road,
                            state, 
                            country, 
                            country_code,
                            ABS(lat - ?) + ABS(lon - ?) as distance_approx,
                            display_name,
                            house_number,
                            neighbourhood,
                            suburb,
                            county,
                            province,
                            postcode,
                            COALESCE(city, village, town, name) as city_name,
                            village,
                            town,
                            city
                        FROM detailed_geocoding 
                        WHERE lat BETWEEN ? AND ? 
                        AND lon BETWEEN ? AND ?
                        ORDER BY distance_approx LIMIT 1
                        """,
                        'params': (lat, lon, lat - lat_range, lat + lat_range, lon - lon_range, lon + lon_range)
                    })
                
                if 'cities' in tables:
                    # Check columns in cities table
                    cursor.execute("PRAGMA table_info(cities)")
                    city_columns = [col[1] for col in cursor.fetchall()]
                    logger.debug(f"Cities table columns: {city_columns}")
                    
                    if 'lat' in city_columns and 'lon' in city_columns:
                        queries_to_try.append({
                            'query': """
                            SELECT name, admin1, admin2, cc, 
                                   ABS(lat - ?) + ABS(lon - ?) as distance_approx
                            FROM cities 
                            WHERE lat BETWEEN ? AND ? 
                            AND lon BETWEEN ? AND ?
                            ORDER BY distance_approx LIMIT 1
                            """,
                            'params': (lat, lon, lat - lat_range, lat + lat_range, lon - lon_range, lon + lon_range)
                        })
                
                if 'locations' in tables:
                    # Check columns in locations table
                    cursor.execute("PRAGMA table_info(locations)")
                    location_columns = [col[1] for col in cursor.fetchall()]
                    logger.debug(f"Locations table columns: {location_columns}")
                    
                    if 'latitude' in location_columns and 'longitude' in location_columns:
                        queries_to_try.append({
                            'query': """
                            SELECT display_name, state, country, country_code,
                                   ABS(latitude - ?) + ABS(longitude - ?) as distance_approx
                            FROM locations
                            WHERE latitude BETWEEN ? AND ? 
                            AND longitude BETWEEN ? AND ?
                            ORDER BY distance_approx LIMIT 1
                            """,
                            'params': (lat, lon, lat - lat_range, lat + lat_range, lon - lon_range, lon + lon_range)
                        })
                
                # Try geocoding_data table if it exists
                if 'geocoding_data' in tables:
                    cursor.execute("PRAGMA table_info(geocoding_data)")
                    geocoding_columns = [col[1] for col in cursor.fetchall()]
                    logger.debug(f"Geocoding_data table columns: {geocoding_columns}")
                    
                    if 'lat' in geocoding_columns and 'lon' in geocoding_columns:
                        queries_to_try.append({
                            'query': """
                            SELECT city, state, country, country_code,
                                   ABS(lat - ?) + ABS(lon - ?) as distance_approx
                            FROM geocoding_data
                            WHERE lat BETWEEN ? AND ? 
                            AND lon BETWEEN ? AND ?
                            ORDER BY distance_approx LIMIT 1
                            """,
                            'params': (lat, lon, lat - lat_range, lat + lat_range, lon - lon_range, lon + lon_range)
                        })
                
                # Execute queries until we find a result
                for i, query_info in enumerate(queries_to_try):
                    try:
                        cursor.execute(query_info['query'], query_info['params'])
                        result = cursor.fetchone()
                        
                        if result and result[0]:  # Make sure we have a valid result
                            logger.debug(f"Found offline result: {result}")
                            
                            # Handle detailed_geocoding table result (more fields)
                            if i == 0 and 'detailed_geocoding' in tables:
                                return {
                                    "road": result[0] if result[0] else "",
                                    "state": result[1] if result[1] else "",
                                    "country": result[2] if result[2] else "",
                                    "country_code": result[3] if result[3] else "",
                                    "distance": result[4] if len(result) > 4 else 0,
                                    "display_name": result[5] if len(result) > 5 and result[5] else "",
                                    "house_number": result[6] if len(result) > 6 and result[6] else "",
                                    "neighbourhood": result[7] if len(result) > 7 and result[7] else "",
                                    "suburb": result[8] if len(result) > 8 and result[8] else "",
                                    "county": result[9] if len(result) > 9 and result[9] else "",
                                    "province": result[10] if len(result) > 10 and result[10] else "",
                                    "postcode": result[11] if len(result) > 11 and result[11] else "",
                                    "city": result[12] if len(result) > 12 and result[12] else "",  # city_name
                                    "village": result[13] if len(result) > 13 and result[13] else "",
                                    "town": result[14] if len(result) > 14 and result[14] else "",
                                    "source": "offline_database_detailed",
                                    # Legacy fields for backward compatibility
                                    "name": result[12] if len(result) > 12 and result[12] else "Unknown",
                                    "admin1": result[1] if result[1] else "",
                                    "admin2": result[2] if result[2] else "",
                                    "cc": result[3] if result[3] else ""
                                }
                            else:
                                # Handle other table formats (basic format)
                                return {
                                    "name": result[0] or "Unknown",
                                    "admin1": result[1] or "" if len(result) > 1 else "",
                                    "admin2": result[2] or "" if len(result) > 2 else "",
                                    "cc": result[3] or "" if len(result) > 3 else "",
                                    "distance": result[4] if len(result) > 4 else 0,
                                    "source": "offline_database"
                                }
                    except sqlite3.OperationalError as e:
                        logger.debug(f"Query failed: {str(e)}")
                        continue
                    except Exception as e:
                        logger.warning(f"Error executing query: {str(e)}")
                        continue
                
                logger.debug(f"No offline results found for {lat:.6f}, {lon:.6f}")
                return None
                
        except Exception as e:
            logger.error(f"Error in offline reverse geocoding: {str(e)}")
            return None


async def store_geodata_in_db(geodata: Dict, trip_id: str, waypoint: Dict):
    """Store geodata in the offline geocoding database"""
    try:
        db_path = os.path.join(os.path.dirname(__file__), "../../../data/geocoding_offline.db")
        
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            
            # Create detailed geocoding table if it doesn't exist
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS detailed_geocoding (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lat REAL NOT NULL,
                    lon REAL NOT NULL,
                    trip_id TEXT,
                    place_id INTEGER,
                    osm_type TEXT,
                    osm_id INTEGER,
                    class TEXT,
                    type TEXT,
                    place_rank INTEGER,
                    importance REAL,
                    addresstype TEXT,
                    name TEXT,
                    display_name TEXT,
                    road TEXT,
                    house_number TEXT,
                    neighbourhood TEXT,
                    suburb TEXT,
                    village TEXT,
                    town TEXT,
                    city TEXT,
                    municipality TEXT,
                    county TEXT,
                    state_district TEXT,
                    state TEXT,
                    region TEXT,
                    province TEXT,
                    postcode TEXT,
                    country TEXT,
                    country_code TEXT,
                    ISO3166_2_lvl4 TEXT,
                    ISO3166_2_lvl6 TEXT,
                    boundingbox_south REAL,
                    boundingbox_north REAL,
                    boundingbox_west REAL,
                    boundingbox_east REAL,
                    source TEXT,
                    raw_response TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(lat, lon, trip_id) ON CONFLICT REPLACE
                )
            """)
            
            # Extract address information safely
            address = geodata.get("address", {}) or {}
            raw_response = geodata.get("raw_response", "")
            
            # Extract bounding box
            boundingbox = geodata.get("boundingbox", [])
            bbox_south = float(boundingbox[0]) if len(boundingbox) > 0 else None
            bbox_north = float(boundingbox[1]) if len(boundingbox) > 1 else None
            bbox_west = float(boundingbox[2]) if len(boundingbox) > 2 else None
            bbox_east = float(boundingbox[3]) if len(boundingbox) > 3 else None
            
            # Insert detailed geocoding data
            cursor.execute("""
                INSERT OR REPLACE INTO detailed_geocoding (
                    lat, lon, trip_id, place_id, osm_type, osm_id, class, type,
                    place_rank, importance, addresstype, name, display_name,
                    road, house_number, neighbourhood, suburb, village, town, city,
                    municipality, county, state_district, state, region, province,
                    postcode, country, country_code, ISO3166_2_lvl4, ISO3166_2_lvl6,
                    boundingbox_south, boundingbox_north, boundingbox_west, boundingbox_east,
                    source, raw_response
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                geodata.get("lat", waypoint.get("latitude", 0)),
                geodata.get("lon", waypoint.get("longitude", 0)),
                trip_id,
                geodata.get("place_id"),
                geodata.get("osm_type"),
                geodata.get("osm_id"),
                geodata.get("class"),
                geodata.get("type"),
                geodata.get("place_rank"),
                geodata.get("importance"),
                geodata.get("addresstype"),
                geodata.get("name"),
                geodata.get("display_name"),
                address.get("road"),
                address.get("house_number"),
                address.get("neighbourhood"),
                address.get("suburb"),
                address.get("village"),
                address.get("town"),
                address.get("city"),
                address.get("municipality"),
                address.get("county"),
                address.get("state_district"),
                address.get("state"),
                address.get("region"),
                address.get("province"),
                address.get("postcode"),
                address.get("country"),
                address.get("country_code"),
                address.get("ISO3166-2-lvl4"),
                address.get("ISO3166-2-lvl6"),
                bbox_south,
                bbox_north,
                bbox_west,
                bbox_east,
                geodata.get("source", "online"),
                str(raw_response) if raw_response else None
            ))
            
            # Also store in the simplified format for backward compatibility
            cursor.execute("""
                INSERT OR REPLACE INTO offline_geocoding (
                    lat_min, lat_max, lon_min, lon_max, city, state, country, country_code, level
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                geodata.get("lat", waypoint.get("latitude", 0)) - 0.001,
                geodata.get("lat", waypoint.get("latitude", 0)) + 0.001,
                geodata.get("lon", waypoint.get("longitude", 0)) - 0.001,
                geodata.get("lon", waypoint.get("longitude", 0)) + 0.001,
                address.get("city") or address.get("village") or address.get("town") or geodata.get("name", ""),
                address.get("state") or address.get("region"),
                address.get("country"),
                address.get("country_code"),
                1
            ))
            
            conn.commit()
            logger.info(f"Stored detailed geocoding data for {geodata.get('lat')}, {geodata.get('lon')} in trip {trip_id}")
            
    except Exception as e:
        logger.error(f"Error storing geodata in database: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
