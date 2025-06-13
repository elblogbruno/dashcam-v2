#!/usr/bin/env python3
"""
Script mejorado para reparar la base de datos de geocodificación.
Maneja tanto formato JSON como diccionarios de Python en raw_response.
Distribuye correctamente los datos concatenados en el campo 'name' a los campos apropiados.
"""

import sqlite3
import json
import ast
import logging
import shutil
from datetime import datetime
from pathlib import Path

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def backup_database(db_path):
    """Crear una copia de seguridad de la base de datos"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{db_path}.backup_{timestamp}"
    
    try:
        shutil.copy2(db_path, backup_path)
        logger.info(f"Backup creado: {backup_path}")
        return backup_path
    except Exception as e:
        logger.error(f"Error creando backup: {e}")
        return None

def parse_raw_response(raw_response_str):
    """
    Parsea el raw_response, manejando tanto formato JSON como diccionario de Python
    """
    if not raw_response_str:
        return None
    
    # Primero intentar JSON
    try:
        return json.loads(raw_response_str)
    except json.JSONDecodeError:
        pass
    
    # Si falla, intentar como diccionario de Python
    try:
        return ast.literal_eval(raw_response_str)
    except (ValueError, SyntaxError):
        pass
    
    logger.warning(f"No se pudo parsear raw_response: {raw_response_str[:100]}...")
    return None

def extract_address_components(raw_response):
    """Extrae los componentes de dirección del raw_response parseado"""
    if not raw_response or not isinstance(raw_response, dict):
        return {}
    
    # Datos principales
    components = {
        'place_id': raw_response.get('place_id'),
        'osm_type': raw_response.get('osm_type'),
        'osm_id': raw_response.get('osm_id'),
        'class': raw_response.get('class'),
        'type': raw_response.get('type'),
        'place_rank': raw_response.get('place_rank'),
        'importance': raw_response.get('importance'),
        'addresstype': raw_response.get('addresstype'),
        'name': raw_response.get('name'),
        'display_name': raw_response.get('display_name')
    }
    
    # Boundingbox
    boundingbox = raw_response.get('boundingbox', [])
    if len(boundingbox) >= 4:
        components.update({
            'boundingbox_south': boundingbox[0],
            'boundingbox_north': boundingbox[1],
            'boundingbox_west': boundingbox[2],
            'boundingbox_east': boundingbox[3]
        })
    
    # Dirección
    address = raw_response.get('address', {})
    if address:
        components.update({
            'road': address.get('road'),
            'house_number': address.get('house_number'),
            'neighbourhood': address.get('quarter') or address.get('neighbourhood'),
            'suburb': address.get('suburb'),
            'village': address.get('village'),
            'town': address.get('town'),
            'city': address.get('city'),
            'municipality': address.get('municipality'),
            'county': address.get('county'),
            'state_district': address.get('state_district'),
            'state': address.get('state'),
            'region': address.get('region'),
            'province': address.get('province'),
            'postcode': address.get('postcode'),
            'country': address.get('country'),
            'country_code': address.get('country_code'),
            'ISO3166_2_lvl4': address.get('ISO3166-2-lvl4'),
            'ISO3166_2_lvl6': address.get('ISO3166-2-lvl6')
        })
    
    return components

def parse_concatenated_address(name_field):
    """
    Parsea una dirección concatenada del campo name
    Formato típico: "component1, component2, component3, ..."
    """
    if not name_field or ',' not in name_field:
        return {}
    
    parts = [part.strip() for part in name_field.split(',')]
    components = {}
    
    # Heurísticas para mapear componentes
    for i, part in enumerate(parts):
        if not part:
            continue
            
        # El primer componente suele ser road o name
        if i == 0:
            # Si parece una dirección (contiene números), es road
            if any(char.isdigit() for char in part):
                components['road'] = part
            else:
                components['name'] = part
        
        # Los últimos componentes suelen ser country y postcode
        elif i == len(parts) - 1:
            # Si es solo números, es postcode
            if part.isdigit():
                components['postcode'] = part
            else:
                components['country'] = part
        
        elif i == len(parts) - 2:
            # Segundo desde el final, suele ser state/province
            if not part.isdigit():
                components['state'] = part
        
        # Componentes del medio
        else:
            # Asignar a city si no tenemos uno aún
            if 'city' not in components and not part.isdigit():
                components['city'] = part
            elif 'county' not in components and not part.isdigit():
                components['county'] = part
    
    return components

def fix_geocoding_records():
    """Función principal para reparar los registros de geocodificación"""
    
    db_path = 'data/geocoding_offline.db'
    
    # Verificar que existe la base de datos
    if not Path(db_path).exists():
        logger.error(f"No se encontró la base de datos: {db_path}")
        return False
    
    # Crear backup
    backup_path = backup_database(db_path)
    if not backup_path:
        logger.error("No se pudo crear el backup. Abortando.")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Obtener registros que necesitan reparación
        cursor.execute('''
            SELECT id, name, raw_response 
            FROM detailed_geocoding 
            WHERE raw_response IS NOT NULL AND raw_response != ""
        ''')
        
        records = cursor.fetchall()
        logger.info(f"Encontrados {len(records)} registros para procesar")
        
        processed_count = 0
        raw_response_success = 0
        name_parsing_success = 0
        errors = 0
        
        for record_id, name_field, raw_response_str in records:
            try:
                # Intentar extraer datos del raw_response
                raw_response = parse_raw_response(raw_response_str)
                
                if raw_response:
                    # Extraer componentes del raw_response
                    components = extract_address_components(raw_response)
                    raw_response_success += 1
                else:
                    # Si no se puede parsear raw_response, intentar parsear el campo name
                    components = parse_concatenated_address(name_field)
                    if components:
                        name_parsing_success += 1
                    else:
                        logger.warning(f"No se pudieron extraer componentes para registro {record_id}")
                        errors += 1
                        continue
                
                # Preparar la consulta de actualización
                update_fields = []
                update_values = []
                
                # Lista de campos que podemos actualizar
                updatable_fields = [
                    'place_id', 'osm_type', 'osm_id', 'class', 'type', 'place_rank', 
                    'importance', 'addresstype', 'name', 'display_name', 'road', 
                    'house_number', 'neighbourhood', 'suburb', 'village', 'town', 
                    'city', 'municipality', 'county', 'state_district', 'state', 
                    'region', 'province', 'postcode', 'country', 'country_code', 
                    'ISO3166_2_lvl4', 'ISO3166_2_lvl6', 'boundingbox_south', 
                    'boundingbox_north', 'boundingbox_west', 'boundingbox_east'
                ]
                
                # Solo actualizar campos que tienen valores
                for field in updatable_fields:
                    if field in components and components[field] is not None:
                        # Convertir "None" string a NULL
                        value = components[field]
                        if isinstance(value, str) and value.lower() == 'none':
                            value = None
                        
                        update_fields.append(f"{field} = ?")
                        update_values.append(value)
                
                if update_fields:
                    update_query = f"UPDATE detailed_geocoding SET {', '.join(update_fields)} WHERE id = ?"
                    update_values.append(record_id)
                    
                    cursor.execute(update_query, update_values)
                    processed_count += 1
                    
                    if processed_count % 1000 == 0:
                        logger.info(f"Procesados {processed_count} registros...")
                        conn.commit()
                
            except Exception as e:
                logger.error(f"Error procesando registro {record_id}: {e}")
                errors += 1
                continue
        
        # Commit final
        conn.commit()
        
        # Limpiar valores "None" restantes
        logger.info("Limpiando valores 'None' restantes...")
        cleanup_fields = ['road', 'city', 'state', 'country', 'postcode', 'county']
        for field in cleanup_fields:
            cursor.execute(f"UPDATE detailed_geocoding SET {field} = NULL WHERE {field} = 'None'")
        
        conn.commit()
        conn.close()
        
        logger.info(f"Procesamiento completado:")
        logger.info(f"- Registros procesados: {processed_count}")
        logger.info(f"- Éxito con raw_response: {raw_response_success}")
        logger.info(f"- Éxito parseando name: {name_parsing_success}")
        logger.info(f"- Errores: {errors}")
        
        return True
        
    except Exception as e:
        logger.error(f"Error durante el procesamiento: {e}")
        return False

def verify_repair():
    """Verifica que la reparación fue exitosa"""
    
    try:
        conn = sqlite3.connect('data/geocoding_offline.db')
        cursor = conn.cursor()
        
        # Estadísticas generales
        cursor.execute('SELECT COUNT(*) FROM detailed_geocoding')
        total_records = cursor.fetchone()[0]
        
        # Contar campos con datos
        statistics = {}
        fields_to_check = ['road', 'city', 'state', 'country', 'postcode', 'county']
        
        for field in fields_to_check:
            cursor.execute(f'SELECT COUNT(*) FROM detailed_geocoding WHERE {field} IS NOT NULL AND {field} != ""')
            count = cursor.fetchone()[0]
            statistics[field] = count
        
        # Contar registros problemáticos restantes
        cursor.execute('SELECT COUNT(*) FROM detailed_geocoding WHERE (road IS NULL OR road = "") AND name LIKE "%,%"')
        remaining_concatenated = cursor.fetchone()[0]
        
        logger.info("=== VERIFICACIÓN DE REPARACIÓN ===")
        logger.info(f"Total de registros: {total_records}")
        logger.info("Campos poblados:")
        for field, count in statistics.items():
            percentage = (count / total_records) * 100 if total_records > 0 else 0
            logger.info(f"  {field}: {count} ({percentage:.1f}%)")
        
        logger.info(f"Registros con datos aún concatenados: {remaining_concatenated}")
        
        conn.close()
        
        return remaining_concatenated == 0
        
    except Exception as e:
        logger.error(f"Error en la verificación: {e}")
        return False

if __name__ == "__main__":
    logger.info("=== INICIANDO REPARACIÓN MEJORADA DE BASE DE DATOS DE GEOCODIFICACIÓN ===")
    
    if fix_geocoding_records():
        logger.info("✅ Reparación completada exitosamente")
        
        if verify_repair():
            logger.info("✅ Verificación exitosa: Base de datos reparada correctamente")
        else:
            logger.warning("⚠️ Verificación: Aún hay algunos registros que necesitan atención")
    else:
        logger.error("❌ Error durante la reparación")
