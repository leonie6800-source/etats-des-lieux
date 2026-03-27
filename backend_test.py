#!/usr/bin/env python3
"""
Backend Test Suite for État des Lieux Pro - Cloudinary Integration
Tests the 3 new Cloudinary integration tasks:
1. Photo upload to Cloudinary (POST /api/photos)
2. Photo delete from Cloudinary (DELETE /api/photos/:id)  
3. EDL bulk delete with Cloudinary cleanup (DELETE /api/edl/:id)
"""

import requests
import json
import time
import sys
from urllib.parse import urlparse

# Base URL from environment
BASE_URL = "https://property-inspect-16.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test image - small 1x1 pixel PNG in base64
TEST_IMAGE_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

def log_test(message, status="INFO"):
    """Log test messages with status"""
    print(f"[{status}] {message}")

def make_request(method, endpoint, data=None, expected_status=None):
    """Make HTTP request with error handling"""
    url = f"{API_BASE}/{endpoint.lstrip('/')}"
    
    try:
        if method.upper() == 'GET':
            response = requests.get(url, timeout=30)
        elif method.upper() == 'POST':
            response = requests.post(url, json=data, timeout=30)
        elif method.upper() == 'PUT':
            response = requests.put(url, json=data, timeout=30)
        elif method.upper() == 'DELETE':
            response = requests.delete(url, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
            
        log_test(f"{method} {endpoint} -> {response.status_code}")
        
        if expected_status and response.status_code != expected_status:
            log_test(f"Expected status {expected_status}, got {response.status_code}", "ERROR")
            log_test(f"Response: {response.text}", "ERROR")
            return None
            
        if response.status_code >= 400:
            log_test(f"HTTP Error {response.status_code}: {response.text}", "ERROR")
            return None
            
        return response.json() if response.content else {}
        
    except requests.exceptions.RequestException as e:
        log_test(f"Request failed: {str(e)}", "ERROR")
        return None
    except json.JSONDecodeError as e:
        log_test(f"JSON decode error: {str(e)}", "ERROR")
        return None

def verify_cloudinary_url_accessible(url):
    """Verify that a Cloudinary URL is accessible"""
    try:
        response = requests.head(url, timeout=10)
        return response.status_code == 200
    except:
        return False

def verify_cloudinary_url_deleted(url):
    """Verify that a Cloudinary URL returns 404 (deleted)"""
    try:
        response = requests.head(url, timeout=10)
        return response.status_code == 404
    except:
        return True  # If request fails, assume it's deleted

def test_cloudinary_photo_upload():
    """TEST 1: Upload Photo to Cloudinary (POST /api/photos)"""
    log_test("=== TEST 1: Cloudinary Photo Upload ===", "INFO")
    
    # Step 1: Create test EDL
    log_test("Creating test EDL...")
    edl_data = {
        "adresse": "123 Test Cloudinary Street",
        "type_logement": "T2",
        "type_edl": "entree",
        "nom_locataire": "Test Cloudinary Tenant",
        "nom_proprietaire": "Test Cloudinary Owner"
    }
    
    edl = make_request('POST', '/edl', edl_data, 201)
    if not edl:
        log_test("Failed to create EDL", "ERROR")
        return False
        
    edl_id = edl['id']
    pieces = edl.get('pieces', [])
    if not pieces:
        log_test("No pieces found in EDL", "ERROR")
        return False
        
    piece_id = pieces[0]['id']
    log_test(f"Created EDL {edl_id} with piece {piece_id}")
    
    # Step 2: Upload photo with Cloudinary
    log_test("Uploading photo to Cloudinary...")
    photo_data = {
        "piece_id": piece_id,
        "edl_id": edl_id,
        "data": TEST_IMAGE_BASE64,
        "legende": "Test photo Cloudinary",
        "horodatage": "2025-01-15T10:00:00Z",
        "gps": {"lat": 48.8566, "lng": 2.3522}
    }
    
    photo = make_request('POST', '/photos', photo_data, 201)
    if not photo:
        log_test("Failed to upload photo", "ERROR")
        return False
        
    # Step 3: Verify Cloudinary integration
    log_test("Verifying Cloudinary integration...")
    
    # Check response structure
    if 'url' not in photo:
        log_test("❌ Response missing 'url' field", "ERROR")
        return False
        
    if 'public_id' not in photo:
        log_test("❌ Response missing 'public_id' field", "ERROR")
        return False
        
    if 'data' in photo and photo['data'] is not None:
        log_test("❌ Response should not contain 'data' field (security)", "ERROR")
        return False
        
    cloudinary_url = photo['url']
    public_id = photo['public_id']
    
    # Verify URL format
    if not cloudinary_url.startswith('https://res.cloudinary.com/'):
        log_test(f"❌ Invalid Cloudinary URL format: {cloudinary_url}", "ERROR")
        return False
        
    # Verify public_id format (should contain edl_id and piece_id)
    if edl_id not in public_id or piece_id not in public_id:
        log_test(f"❌ public_id should contain edl_id and piece_id: {public_id}", "ERROR")
        return False
        
    log_test(f"✅ Cloudinary URL: {cloudinary_url}")
    log_test(f"✅ Public ID: {public_id}")
    
    # Step 4: Verify image is accessible on Cloudinary
    log_test("Verifying image accessibility on Cloudinary...")
    if not verify_cloudinary_url_accessible(cloudinary_url):
        log_test("❌ Image not accessible on Cloudinary", "ERROR")
        return False
        
    log_test("✅ Image accessible on Cloudinary")
    
    # Step 5: Verify MongoDB storage (no base64 data)
    log_test("Verifying MongoDB storage...")
    stored_photo = make_request('GET', f'/photos/{photo["id"]}', expected_status=200)
    if not stored_photo:
        log_test("Failed to retrieve stored photo", "ERROR")
        return False
        
    if stored_photo.get('data') is not None:
        log_test("❌ MongoDB should not contain base64 data", "ERROR")
        return False
        
    if stored_photo.get('url') != cloudinary_url:
        log_test("❌ MongoDB URL doesn't match Cloudinary URL", "ERROR")
        return False
        
    if stored_photo.get('public_id') != public_id:
        log_test("❌ MongoDB public_id doesn't match", "ERROR")
        return False
        
    log_test("✅ MongoDB storage verified (no base64, has URL and public_id)")
    
    log_test("✅ TEST 1 PASSED: Cloudinary Photo Upload", "SUCCESS")
    return {'edl_id': edl_id, 'photo_id': photo['id'], 'url': cloudinary_url, 'public_id': public_id}

def test_cloudinary_photo_delete(test_data):
    """TEST 2: Delete Photo from Cloudinary (DELETE /api/photos/:id)"""
    log_test("=== TEST 2: Cloudinary Photo Delete ===", "INFO")
    
    photo_id = test_data['photo_id']
    cloudinary_url = test_data['url']
    
    # Step 1: Verify photo exists before deletion
    log_test("Verifying photo exists before deletion...")
    if not verify_cloudinary_url_accessible(cloudinary_url):
        log_test("❌ Photo not accessible before deletion", "ERROR")
        return False
        
    log_test("✅ Photo accessible before deletion")
    
    # Step 2: Delete photo
    log_test(f"Deleting photo {photo_id}...")
    result = make_request('DELETE', f'/photos/{photo_id}', expected_status=200)
    if not result:
        log_test("Failed to delete photo", "ERROR")
        return False
        
    log_test("✅ Photo deleted from MongoDB")
    
    # Step 3: Verify photo deleted from MongoDB
    log_test("Verifying photo deleted from MongoDB...")
    deleted_photo = make_request('GET', f'/photos/{photo_id}', expected_status=404)
    if deleted_photo is not None:
        log_test("❌ Photo still exists in MongoDB", "ERROR")
        return False
        
    log_test("✅ Photo deleted from MongoDB")
    
    # Step 4: Verify photo deleted from Cloudinary (may take a moment)
    log_test("Verifying photo deleted from Cloudinary...")
    time.sleep(2)  # Give Cloudinary time to process deletion
    
    if not verify_cloudinary_url_deleted(cloudinary_url):
        log_test("❌ Photo still accessible on Cloudinary", "ERROR")
        return False
        
    log_test("✅ Photo deleted from Cloudinary")
    
    log_test("✅ TEST 2 PASSED: Cloudinary Photo Delete", "SUCCESS")
    return True

def test_cloudinary_bulk_delete():
    """TEST 3: EDL Bulk Delete with Cloudinary cleanup (DELETE /api/edl/:id)"""
    log_test("=== TEST 3: Cloudinary Bulk Delete ===", "INFO")
    
    # Step 1: Create test EDL
    log_test("Creating test EDL for bulk delete...")
    edl_data = {
        "adresse": "456 Bulk Delete Street",
        "type_logement": "T2",
        "type_edl": "entree",
        "nom_locataire": "Bulk Test Tenant",
        "nom_proprietaire": "Bulk Test Owner"
    }
    
    edl = make_request('POST', '/edl', edl_data, 201)
    if not edl:
        log_test("Failed to create EDL", "ERROR")
        return False
        
    edl_id = edl['id']
    pieces = edl.get('pieces', [])
    if len(pieces) < 2:
        log_test("Need at least 2 pieces for bulk test", "ERROR")
        return False
        
    log_test(f"Created EDL {edl_id} with {len(pieces)} pieces")
    
    # Step 2: Upload 2 photos to different pieces
    log_test("Uploading 2 photos to Cloudinary...")
    photos_data = []
    
    for i, piece in enumerate(pieces[:2]):
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
            log_test(f"Failed to upload photo {i+1}", "ERROR")
            return False
            
        photos_data.append({
            'id': photo['id'],
            'url': photo['url'],
            'public_id': photo['public_id']
        })
        
        log_test(f"✅ Uploaded photo {i+1}: {photo['url']}")
    
    # Step 3: Verify both photos are accessible
    log_test("Verifying both photos are accessible...")
    for i, photo in enumerate(photos_data):
        if not verify_cloudinary_url_accessible(photo['url']):
            log_test(f"❌ Photo {i+1} not accessible", "ERROR")
            return False
            
    log_test("✅ Both photos accessible on Cloudinary")
    
    # Step 4: Delete entire EDL (should trigger bulk Cloudinary cleanup)
    log_test(f"Deleting entire EDL {edl_id}...")
    result = make_request('DELETE', f'/edl/{edl_id}', expected_status=200)
    if not result:
        log_test("Failed to delete EDL", "ERROR")
        return False
        
    log_test("✅ EDL deleted")
    
    # Step 5: Verify EDL deleted from MongoDB
    log_test("Verifying EDL deleted from MongoDB...")
    deleted_edl = make_request('GET', f'/edl/{edl_id}', expected_status=404)
    if deleted_edl is not None:
        log_test("❌ EDL still exists in MongoDB", "ERROR")
        return False
        
    log_test("✅ EDL deleted from MongoDB")
    
    # Step 6: Verify all photos deleted from MongoDB
    log_test("Verifying all photos deleted from MongoDB...")
    for i, photo in enumerate(photos_data):
        deleted_photo = make_request('GET', f'/photos/{photo["id"]}', expected_status=404)
        if deleted_photo is not None:
            log_test(f"❌ Photo {i+1} still exists in MongoDB", "ERROR")
            return False
            
    log_test("✅ All photos deleted from MongoDB")
    
    # Step 7: Verify all photos deleted from Cloudinary
    log_test("Verifying all photos deleted from Cloudinary...")
    time.sleep(3)  # Give Cloudinary time to process bulk deletion
    
    for i, photo in enumerate(photos_data):
        if not verify_cloudinary_url_deleted(photo['url']):
            log_test(f"❌ Photo {i+1} still accessible on Cloudinary", "ERROR")
            return False
            
    log_test("✅ All photos deleted from Cloudinary")
    
    log_test("✅ TEST 3 PASSED: Cloudinary Bulk Delete", "SUCCESS")
    return True

def main():
    """Run all Cloudinary integration tests"""
    log_test("Starting Cloudinary Integration Tests", "INFO")
    log_test(f"Base URL: {BASE_URL}", "INFO")
    log_test(f"API Base: {API_BASE}", "INFO")
    
    try:
        # Test 1: Photo Upload
        test1_result = test_cloudinary_photo_upload()
        if not test1_result:
            log_test("❌ TEST 1 FAILED - Stopping tests", "ERROR")
            return False
            
        # Test 2: Photo Delete
        test2_result = test_cloudinary_photo_delete(test1_result)
        if not test2_result:
            log_test("❌ TEST 2 FAILED - Continuing with Test 3", "ERROR")
            
        # Test 3: Bulk Delete
        test3_result = test_cloudinary_bulk_delete()
        if not test3_result:
            log_test("❌ TEST 3 FAILED", "ERROR")
            return False
            
        log_test("🎉 ALL CLOUDINARY TESTS PASSED!", "SUCCESS")
        return True
        
    except Exception as e:
        log_test(f"Unexpected error: {str(e)}", "ERROR")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)