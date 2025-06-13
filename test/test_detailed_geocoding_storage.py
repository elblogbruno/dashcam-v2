#!/usr/bin/env python3
"""Test script for detailed geocoding storage functionality"""

import asyncio
import json
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from geocoding.utils.db_storage import store_geodata_in_db, DBStorage

async def test_detailed_storage():
    """Test storing detailed geocoding data"""
    
    # Sample geodata based on the log entry provided
    geodata = {
        "lat": 41.780643,
        "lon": 1.834485,
        "place_id": 76107623,
        "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright",
        "osm_type": "way",
        "osm_id": 539488987,
        "class": "highway",
        "type": "residential", 
        "place_rank": 26,
        "importance": 0.05339357213702598,
        "addresstype": "road",
        "name": "Carrer de Prat de la Riba",
        "display_name": "Carrer de Prat de la Riba, Mirador de Montserrat, Santpedor, Bages, Barcelona, Catalunya, 08251, España",
        "address": {
            "road": "Carrer de Prat de la Riba",
            "village": "Mirador de Montserrat",
            "county": "Bages",
            "province": "Barcelona",
            "ISO3166-2-lvl6": "ES-B",
            "state": "Catalunya",
            "ISO3166-2-lvl4": "ES-CT",
            "postcode": "08251",
            "country": "España",
            "country_code": "es"
        },
        "boundingbox": [
            "41.7804266",
            "41.7818805", 
            "1.8341192",
            "1.8348369"
        ],
        "source": "nominatim",
        "raw_response": json.dumps({
            "place_id": 76107623,
            "licence": "Data © OpenStreetMap contributors, ODbL 1.0. http://osm.org/copyright",
            "osm_type": "way",
            "osm_id": 539488987,
            "lat": "41.7807404",
            "lon": "1.8346807",
            "class": "highway",
            "type": "residential",
            "place_rank": 26,
            "importance": 0.05339357213702598,
            "addresstype": "road",
            "name": "Carrer de Prat de la Riba",
            "display_name": "Carrer de Prat de la Riba, Mirador de Montserrat, Santpedor, Bages, Barcelona, Catalunya, 08251, España"
        })
    }
    
    waypoint = {
        "latitude": 41.780643,
        "longitude": 1.834485
    }
    
    trip_id = "test_trip_detailed_001"
    
    print("Testing detailed geocoding storage...")
    print(f"Storing data for coordinates: {geodata['lat']}, {geodata['lon']}")
    print(f"Location: {geodata['display_name']}")
    
    # Store the data
    await store_geodata_in_db(geodata, trip_id, waypoint)
    
    print("\nTesting retrieval...")
    
    # Test retrieval
    db_storage = DBStorage()
    result = await db_storage.reverse_geocode(geodata['lat'], geodata['lon'])
    
    if result:
        print("Successfully retrieved from offline database:")
        print(f"  Name: {result.get('name')}")
        print(f"  State: {result.get('admin1')}")
        print(f"  Country: {result.get('admin2')}")
        print(f"  Country Code: {result.get('cc')}")
        print(f"  Source: {result.get('source')}")
        
        if 'display_name' in result:
            print(f"  Display Name: {result.get('display_name')}")
        if 'road' in result:
            print(f"  Road: {result.get('road')}")
        if 'postcode' in result:
            print(f"  Postcode: {result.get('postcode')}")
            
    else:
        print("No result found in offline database")
    
    # Test nearby coordinates
    print("\nTesting nearby coordinates...")
    nearby_result = await db_storage.reverse_geocode(41.780700, 1.834500)
    
    if nearby_result:
        print("Found nearby result:")
        print(f"  Name: {nearby_result.get('name')}")
        print(f"  Distance: {nearby_result.get('distance')}")
        print(f"  Source: {nearby_result.get('source')}")
    else:
        print("No nearby result found")

if __name__ == "__main__":
    asyncio.run(test_detailed_storage())
