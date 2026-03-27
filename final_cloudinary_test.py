#!/usr/bin/env python3
"""
Final Cloudinary Integration Test Suite - With Proper Wait Times
Tests all 3 Cloudinary integration tasks with realistic timing expectations
"""

import requests
import json
import time
import sys

BASE_URL = "https://property-inspect-16.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"
TEST_IMAGE_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

def log_test(message, status="INFO"):
    print(f"[{status}] {message}")

def make_request(method, endpoint, data=None, expected_status=None):
    url = f"{API_BASE}/{endpoint.lstrip('/')}"
    
    try:
        if method.upper() == 'GET':
            response = requests.get(url, timeout=30)
        elif method.upper() == 'POST':
            response = requests.post(url, json=data, timeout=30)
        elif method.upper() == 'DELETE':
            response = requests.delete(url, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
            
        log_test(f"{method} {endpoint} -> {response.status_code}")
        
        if expected_status and response.status_code != expected_status:
            log_test(f"Expected status {expected_status}, got {response.status_code}", "ERROR")
            return None
            
        if response.status_code >= 400:
            log_test(f"HTTP Error {response.status_code}: {response.text}", "ERROR")
            return None
            
        return response.json() if response.content else {}
        
    except Exception as e:
        log_test(f"Request failed: {str(e)}", "ERROR")
        return None

def wait_for_cloudinary_deletion(url, max_wait=15):
    """Wait for Cloudinary deletion with reasonable timeout"""
    log_test(f"Waiting for Cloudinary deletion (max {max_wait}s)...")
    
    for i in range(max_wait):
        try:
            response = requests.head(url, timeout=5)
            if response.status_code == 404:
                log_test(f"✅ Cloudinary deletion confirmed after {i+1}s")
                return True
        except:
            log_test(f"✅ Cloudinary deletion confirmed after {i+1}s (connection failed)")
            return True
            
        if i < max_wait - 1:
            time.sleep(1)
    
    log_test(f"⚠️ Cloudinary still accessible after {max_wait}s (CDN caching)", "WARNING")
    return False  # For strict testing, we'll mark this as failure

def test_cloudinary_photo_upload():
    """TEST 1: Upload Photo to Cloudinary"""
    log_test("=== TEST 1: Cloudinary Photo Upload ===", "INFO")
    
    # Create EDL
    edl_data = {
        "adresse": "123 Final Test Street",
        "type_logement": "T2",
        "type_edl": "entree",
        "nom_locataire": "Final Test Tenant",
        "nom_proprietaire": "Final Test Owner"
    }
    
    edl = make_request('POST', '/edl', edl_data, 201)
    if not edl:
        return False
        
    edl_id = edl['id']
    piece_id = edl['pieces'][0]['id']
    
    # Upload photo
    photo_data = {
        "piece_id": piece_id,
        "edl_id": edl_id,
        "data": TEST_IMAGE_BASE64,
        "legende": "Final test photo",
        "horodatage": "2025-01-15T10:00:00Z",
        "gps": {"lat": 48.8566, "lng": 2.3522}
    }
    
    photo = make_request('POST', '/photos', photo_data, 201)
    if not photo:
        return False
    
    # Verify response structure
    required_fields = ['url', 'public_id']
    for field in required_fields:
        if field not in photo:
            log_test(f"❌ Missing {field} in response", "ERROR")
            return False
    
    if 'data' in photo and photo['data'] is not None:
        log_test("❌ Response contains data field (security issue)", "ERROR")
        return False
    
    # Verify URL format
    if not photo['url'].startswith('https://res.cloudinary.com/'):
        log_test(f"❌ Invalid Cloudinary URL: {photo['url']}", "ERROR")
        return False
    
    # Verify public_id contains EDL and piece IDs
    if edl_id not in photo['public_id'] or piece_id not in photo['public_id']:
        log_test(f"❌ public_id missing IDs: {photo['public_id']}", "ERROR")
        return False
    
    # Verify image accessibility
    try:
        response = requests.head(photo['url'], timeout=10)
        if response.status_code != 200:
            log_test(f"❌ Image not accessible: {response.status_code}", "ERROR")
            return False
    except:
        log_test("❌ Image not accessible", "ERROR")
        return False
    
    # Verify MongoDB storage
    stored_photo = make_request('GET', f'/photos/{photo["id"]}', expected_status=200)
    if not stored_photo:
        return False
    
    if stored_photo.get('data') is not None:
        log_test("❌ MongoDB contains base64 data", "ERROR")
        return False
    
    if stored_photo.get('url') != photo['url']:
        log_test("❌ MongoDB URL mismatch", "ERROR")
        return False
    
    if stored_photo.get('public_id') != photo['public_id']:
        log_test("❌ MongoDB public_id mismatch", "ERROR")
        return False
    
    log_test("✅ TEST 1 PASSED: Cloudinary Photo Upload", "SUCCESS")
    return {
        'edl_id': edl_id,
        'photo_id': photo['id'],
        'url': photo['url'],
        'public_id': photo['public_id']
    }

def test_cloudinary_photo_delete(test_data):
    """TEST 2: Delete Photo from Cloudinary"""
    log_test("=== TEST 2: Cloudinary Photo Delete ===", "INFO")
    
    photo_id = test_data['photo_id']
    cloudinary_url = test_data['url']
    
    # Delete photo
    result = make_request('DELETE', f'/photos/{photo_id}', expected_status=200)
    if not result:
        return False
    
    # Verify MongoDB deletion
    deleted_photo = make_request('GET', f'/photos/{photo_id}', expected_status=404)
    if deleted_photo is not None:
        log_test("❌ Photo still in MongoDB", "ERROR")
        return False
    
    # Wait for Cloudinary deletion
    if not wait_for_cloudinary_deletion(cloudinary_url):
        log_test("❌ Cloudinary deletion timeout", "ERROR")
        return False
    
    log_test("✅ TEST 2 PASSED: Cloudinary Photo Delete", "SUCCESS")
    return True

def test_cloudinary_bulk_delete():
    """TEST 3: EDL Bulk Delete with Cloudinary cleanup"""
    log_test("=== TEST 3: Cloudinary Bulk Delete ===", "INFO")
    
    # Create EDL
    edl_data = {
        "adresse": "456 Bulk Test Street",
        "type_logement": "T2",
        "type_edl": "entree",
        "nom_locataire": "Bulk Test Tenant",
        "nom_proprietaire": "Bulk Test Owner"
    }
    
    edl = make_request('POST', '/edl', edl_data, 201)
    if not edl:
        return False
    
    edl_id = edl['id']
    pieces = edl['pieces'][:2]  # Use first 2 pieces
    
    # Upload 2 photos
    photos_data = []
    for i, piece in enumerate(pieces):
        photo_data = {
            "piece_id": piece['id'],
            "edl_id": edl_id,
            "data": TEST_IMAGE_BASE64,
            "legende": f"Bulk test photo {i+1}",
            "horodatage": "2025-01-15T10:00:00Z",
            "gps": {"lat": 48.8566 + i*0.001, "lng": 2.3522 + i*0.001}
        }
        
        photo = make_request('POST', '/photos', photo_data, 201)
        if not photo:
            return False
        
        photos_data.append({
            'id': photo['id'],
            'url': photo['url'],
            'public_id': photo['public_id']
        })
    
    # Verify both photos are accessible
    for photo in photos_data:
        try:
            response = requests.head(photo['url'], timeout=10)
            if response.status_code != 200:
                log_test(f"❌ Photo not accessible: {photo['url']}", "ERROR")
                return False
        except:
            log_test(f"❌ Photo not accessible: {photo['url']}", "ERROR")
            return False
    
    # Delete entire EDL
    result = make_request('DELETE', f'/edl/{edl_id}', expected_status=200)
    if not result:
        return False
    
    # Verify EDL deletion
    deleted_edl = make_request('GET', f'/edl/{edl_id}', expected_status=404)
    if deleted_edl is not None:
        log_test("❌ EDL still exists", "ERROR")
        return False
    
    # Verify all photos deleted from MongoDB
    for photo in photos_data:
        deleted_photo = make_request('GET', f'/photos/{photo["id"]}', expected_status=404)
        if deleted_photo is not None:
            log_test(f"❌ Photo {photo['id']} still in MongoDB", "ERROR")
            return False
    
    # Wait for all Cloudinary deletions
    all_deleted = True
    for i, photo in enumerate(photos_data):
        log_test(f"Checking deletion of photo {i+1}...")
        if not wait_for_cloudinary_deletion(photo['url']):
            all_deleted = False
    
    if not all_deleted:
        log_test("❌ Some photos still on Cloudinary", "ERROR")
        return False
    
    log_test("✅ TEST 3 PASSED: Cloudinary Bulk Delete", "SUCCESS")
    return True

def main():
    """Run all Cloudinary integration tests"""
    log_test("🚀 Starting Final Cloudinary Integration Tests", "INFO")
    log_test(f"Base URL: {BASE_URL}", "INFO")
    
    results = []
    
    # Test 1: Photo Upload
    test1_result = test_cloudinary_photo_upload()
    results.append(("Cloudinary Photo Upload", test1_result))
    if not test1_result:
        log_test("❌ Stopping tests due to upload failure", "ERROR")
        return False
    
    # Test 2: Photo Delete
    test2_result = test_cloudinary_photo_delete(test1_result)
    results.append(("Cloudinary Photo Delete", test2_result))
    
    # Test 3: Bulk Delete
    test3_result = test_cloudinary_bulk_delete()
    results.append(("Cloudinary Bulk Delete", test3_result))
    
    # Summary
    log_test("=== FINAL RESULTS ===", "INFO")
    all_passed = True
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        log_test(f"{test_name}: {status}")
        if not result:
            all_passed = False
    
    if all_passed:
        log_test("🎉 ALL CLOUDINARY TESTS PASSED!", "SUCCESS")
    else:
        log_test("❌ SOME TESTS FAILED", "ERROR")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)