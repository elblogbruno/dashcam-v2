#!/usr/bin/env python3
"""
Test script for geodata improvements and error handling
"""

import asyncio
import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from routes.trip_planner import generate_grid_around_point, download_geodata_for_location

def test_generate_grid_around_point():
    """Test the grid generation function with various inputs"""
    print("Testing generate_grid_around_point function...")
    
    # Test normal case
    points = generate_grid_around_point(40.7128, -74.0060, 1.0, 3)  # New York
    print(f"Generated {len(points)} points around NYC")
    assert len(points) > 0, "Should generate points"
    
    # Test edge cases
    points = generate_grid_around_point(0.0, 0.0, 0.5, 2)  # Equator/Prime Meridian
    print(f"Generated {len(points)} points around (0,0)")
    
    # Test invalid inputs
    points = generate_grid_around_point("invalid", -74.0060, 1.0, 3)
    print(f"Invalid lat input generated {len(points)} points (should be 0)")
    assert len(points) == 0, "Should handle invalid input gracefully"
    
    points = generate_grid_around_point(40.7128, -74.0060, -1.0, 3)  # Negative radius
    print(f"Negative radius generated {len(points)} points (should be 0)")
    assert len(points) == 0, "Should handle negative radius"
    
    print("✓ Grid generation tests passed")

async def test_download_geodata_for_location():
    """Test the geodata download function"""
    print("\nTesting download_geodata_for_location function...")
    
    # Test with valid coordinates (Chicago - should work)
    geodata = await download_geodata_for_location(41.8781, -87.6298, 1.0, "Chicago Test")
    print(f"Downloaded {len(geodata)} records for Chicago")
    assert len(geodata) > 0, "Should download geodata for valid location"
    
    # Test with invalid coordinates
    geodata = await download_geodata_for_location(999.0, -999.0, 1.0, "Invalid Location")
    print(f"Downloaded {len(geodata)} records for invalid coordinates (should be 0)")
    assert len(geodata) == 0, "Should handle invalid coordinates gracefully"
    
    # Test with edge case coordinates
    geodata = await download_geodata_for_location(0.0, 0.0, 0.5, "Null Island")
    print(f"Downloaded {len(geodata)} records for (0,0)")
    
    print("✓ Geodata download tests passed")

def test_coordinate_validation():
    """Test coordinate validation logic"""
    print("\nTesting coordinate validation...")
    
    # Valid coordinates
    test_cases = [
        (0.0, 0.0, True),           # Null Island
        (90.0, 180.0, True),        # North Pole, Date Line
        (-90.0, -180.0, True),      # South Pole, Date Line
        (40.7128, -74.0060, True),  # NYC
        (999.0, 0.0, False),        # Invalid lat
        (0.0, 999.0, False),        # Invalid lon
        (-999.0, 0.0, False),       # Invalid lat
        (0.0, -999.0, False),       # Invalid lon
    ]
    
    for lat, lon, should_be_valid in test_cases:
        is_valid = (-90 <= lat <= 90) and (-180 <= lon <= 180)
        assert is_valid == should_be_valid, f"Coordinate validation failed for ({lat}, {lon})"
        print(f"  ({lat:6.1f}, {lon:7.1f}) -> {'Valid' if is_valid else 'Invalid'}")
    
    print("✓ Coordinate validation tests passed")

async def main():
    """Run all tests"""
    print("=== Geodata Improvements Test Suite ===\n")
    
    try:
        test_generate_grid_around_point()
        await test_download_geodata_for_location()
        test_coordinate_validation()
        
        print("\n=== All tests passed! ===")
        print("The geodata improvements are working correctly.")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
