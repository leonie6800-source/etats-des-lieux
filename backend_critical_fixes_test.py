#!/usr/bin/env python3
"""
Backend Test Suite for État des Lieux Pro - Critical P0 Fixes
Tests the 4 critical scenarios mentioned in the review request:
1. Stripe Promo Code TEST100 (NEW FEATURE)
2. Photo Upload with Cloudinary Fallback to Base64
3. EDL and Pieces CRUD with Cache Busters
4. PDF Generation Endpoint
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

def test_stripe_promo_code_test100():
    """TEST 1: Stripe Promo Code TEST100 (NEW FEATURE)"""
    log_test("=== TEST 1: Stripe Promo Code TEST100 ===", "INFO")
    
    # Step 1: Create test EDL
    log_test("Creating test EDL...")
    edl_data = {
        "adresse": "123 Promo Test Street",
        "type_logement": "T2",
        "type_edl": "entree",
        "nom_locataire": "Promo Test Tenant",
        "nom_proprietaire": "Promo Test Owner"
    }
    
    edl = make_request('POST', '/edl', edl_data, 201)
    if not edl:
        log_test("Failed to create EDL", "ERROR")
        return False
        
    edl_id = edl['id']
    log_test(f"Created EDL {edl_id}")
    
    # Step 2: Create Stripe checkout session with TEST100 promo code
    log_test("Creating Stripe checkout session with TEST100 promo code...")
    checkout_data = {
        "plan_code": "one_shot",
        "edl_id": edl_id,
        "origin_url": BASE_URL,
        "promo_code": "TEST100"
    }
    
    checkout_response = make_request('POST', '/stripe/checkout', checkout_data, 200)
    if not checkout_response:
        log_test("Failed to create Stripe checkout session", "ERROR")
        return False
    
    # Step 3: Verify response contains checkout URL
    if 'url' not in checkout_response:
        log_test("❌ Response missing 'url' field", "ERROR")
        return False
        
    checkout_url = checkout_response['url']
    if not checkout_url.startswith('https://checkout.stripe.com/'):
        log_test(f"❌ Invalid Stripe checkout URL format: {checkout_url}", "ERROR")
        return False
        
    log_test(f"✅ Stripe checkout URL created: {checkout_url}")
    
    # Step 4: Verify session metadata contains promo code
    if 'session_id' in checkout_response:
        session_id = checkout_response['session_id']
        log_test(f"✅ Session ID: {session_id}")
    
    log_test("✅ TEST 1 PASSED: Stripe Promo Code TEST100", "SUCCESS")
    return {'edl_id': edl_id, 'checkout_url': checkout_url}

def test_photo_upload_cloudinary_fallback():
    """TEST 2: Photo Upload with Cloudinary Fallback to Base64"""
    log_test("=== TEST 2: Photo Upload with Cloudinary Fallback ===", "INFO")
    
    # Step 1: Create test EDL and piece
    log_test("Creating test EDL...")
    edl_data = {
        "adresse": "456 Photo Test Street",
        "type_logement": "T2",
        "type_edl": "entree",
        "nom_locataire": "Photo Test Tenant",
        "nom_proprietaire": "Photo Test Owner"
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
    
    # Step 2: Upload photo with base64 data
    log_test("Uploading photo with base64 data...")
    photo_data = {
        "piece_id": piece_id,
        "edl_id": edl_id,
        "data": TEST_IMAGE_BASE64,
        "legende": "Test photo fallback",
        "horodatage": "2025-01-15T10:00:00Z",
        "gps": {"lat": 48.8566, "lng": 2.3522}
    }
    
    photo = make_request('POST', '/photos', photo_data, 201)
    if not photo:
        log_test("Failed to upload photo", "ERROR")
        return False
    
    # Step 3: Verify photo saved with either URL (Cloudinary) OR data (Base64 fallback)
    log_test("Verifying photo storage format...")
    
    has_url = 'url' in photo and photo['url'] is not None
    has_data = 'data' in photo and photo['data'] is not None
    
    if has_url:
        log_test(f"✅ Photo saved with Cloudinary URL: {photo['url']}")
        if photo['url'].startswith('https://res.cloudinary.com/'):
            log_test("✅ Valid Cloudinary URL format")
        else:
            log_test("❌ Invalid Cloudinary URL format", "ERROR")
            return False
    elif has_data:
        log_test("✅ Photo saved with Base64 fallback")
        if photo['data'].startswith('data:image/'):
            log_test("✅ Valid Base64 data format")
        else:
            log_test("❌ Invalid Base64 data format", "ERROR")
            return False
    else:
        log_test("❌ Photo has neither URL nor data field", "ERROR")
        return False
    
    log_test("✅ TEST 2 PASSED: Photo Upload with Cloudinary Fallback", "SUCCESS")
    return {'edl_id': edl_id, 'photo_id': photo['id'], 'has_url': has_url}

def test_edl_pieces_crud_cache_busters():
    """TEST 3: EDL and Pieces CRUD with Cache Busters"""
    log_test("=== TEST 3: EDL and Pieces CRUD with Cache Busters ===", "INFO")
    
    # Step 1: Create test EDL
    log_test("Creating test EDL...")
    edl_data = {
        "adresse": "789 Cache Test Street",
        "type_logement": "T3",
        "type_edl": "sortie",
        "nom_locataire": "Cache Test Tenant",
        "nom_proprietaire": "Cache Test Owner"
    }
    
    edl = make_request('POST', '/edl', edl_data, 201)
    if not edl:
        log_test("Failed to create EDL", "ERROR")
        return False
        
    edl_id = edl['id']
    log_test(f"Created EDL {edl_id}")
    
    # Step 2: Test GET /api/edl with cache buster
    log_test("Testing GET /api/edl with cache buster...")
    timestamp = int(time.time() * 1000)
    edl_list = make_request('GET', f'/edl?_t={timestamp}', expected_status=200)
    if not edl_list:
        log_test("Failed to get EDL list with cache buster", "ERROR")
        return False
    
    # Verify cache buster doesn't break query
    if not isinstance(edl_list, list):
        log_test("❌ EDL list should be an array", "ERROR")
        return False
    
    # Find our created EDL
    found_edl = None
    for edl_item in edl_list:
        if edl_item.get('id') == edl_id:
            found_edl = edl_item
            break
    
    if not found_edl:
        log_test("❌ Created EDL not found in list", "ERROR")
        return False
    
    log_test("✅ GET /api/edl with cache buster works")
    
    # Step 3: Test GET /api/pieces with cache buster
    log_test("Testing GET /api/pieces with cache buster...")
    timestamp = int(time.time() * 1000)
    pieces_list = make_request('GET', f'/pieces?edl_id={edl_id}&_t={timestamp}', expected_status=200)
    if not pieces_list:
        log_test("Failed to get pieces list with cache buster", "ERROR")
        return False
    
    # Verify cache buster doesn't break query
    if not isinstance(pieces_list, list):
        log_test("❌ Pieces list should be an array", "ERROR")
        return False
    
    if len(pieces_list) == 0:
        log_test("❌ No pieces found for EDL", "ERROR")
        return False
    
    log_test(f"✅ GET /api/pieces with cache buster works - found {len(pieces_list)} pieces")
    
    # Step 4: Verify stats calculation (pieces_total, pieces_done)
    log_test("Verifying stats calculation...")
    
    # Check if EDL has stats
    if 'pieces_total' not in found_edl:
        log_test("❌ EDL missing pieces_total stat", "ERROR")
        return False
    
    if 'pieces_done' not in found_edl:
        log_test("❌ EDL missing pieces_done stat", "ERROR")
        return False
    
    pieces_total = found_edl['pieces_total']
    pieces_done = found_edl['pieces_done']
    
    if pieces_total != len(pieces_list):
        log_test(f"❌ pieces_total ({pieces_total}) doesn't match actual pieces count ({len(pieces_list)})", "ERROR")
        return False
    
    log_test(f"✅ Stats calculated correctly: {pieces_done}/{pieces_total} pieces done")
    
    log_test("✅ TEST 3 PASSED: EDL and Pieces CRUD with Cache Busters", "SUCCESS")
    return {'edl_id': edl_id, 'pieces': pieces_list}

def test_pdf_generation_endpoint(test_data):
    """TEST 4: PDF Generation Endpoint"""
    log_test("=== TEST 4: PDF Generation Endpoint ===", "INFO")
    
    edl_id = test_data['edl_id']
    
    # Step 1: Complete at least one piece
    log_test("Completing a piece for PDF generation...")
    pieces = test_data['pieces']
    if not pieces:
        log_test("No pieces available for completion", "ERROR")
        return False
    
    piece_id = pieces[0]['id']
    piece_update_data = {
        "donnees_json": {
            "etat_general": {"note": 4, "observations": "Good condition"},
            "murs_plafond": {"note": 4, "observations": "Clean walls"},
            "sol": {"note": 3, "observations": "Minor wear"},
            "equipements": {"note": 4, "observations": "All working"}
        },
        "statut": "completed",
        "observations_generales": "Room inspection completed successfully"
    }
    
    updated_piece = make_request('PUT', f'/pieces/{piece_id}', piece_update_data, 200)
    if not updated_piece:
        log_test("Failed to complete piece", "ERROR")
        return False
    
    log_test(f"✅ Completed piece {piece_id}")
    
    # Step 2: Add a photo to the piece
    log_test("Adding photo to completed piece...")
    photo_data = {
        "piece_id": piece_id,
        "edl_id": edl_id,
        "data": TEST_IMAGE_BASE64,
        "legende": "PDF test photo",
        "horodatage": "2025-01-15T10:00:00Z"
    }
    
    photo = make_request('POST', '/photos', photo_data, 201)
    if not photo:
        log_test("Failed to add photo", "ERROR")
        return False
    
    log_test(f"✅ Added photo {photo['id']}")
    
    # Step 3: Mark EDL as paid with download_token
    log_test("Marking EDL as paid...")
    payment_data = {
        "edl_id": edl_id,
        "amount": 9.90,
        "plan": "one_shot"
    }
    
    payment_result = make_request('POST', '/payment', payment_data, 200)
    if not payment_result:
        log_test("Failed to process payment", "ERROR")
        return False
    
    if 'download_token' not in payment_result:
        log_test("❌ Payment response missing download_token", "ERROR")
        return False
    
    download_token = payment_result['download_token']
    log_test(f"✅ EDL marked as paid with download_token: {download_token}")
    
    # Step 4: Test PDF generation endpoint
    log_test("Testing PDF generation endpoint...")
    
    # Make direct request to PDF endpoint
    pdf_url = f"{API_BASE}/pdf-fresh/{download_token}"
    try:
        response = requests.get(pdf_url, timeout=60)  # PDF generation might take time
        
        if response.status_code != 200:
            log_test(f"❌ PDF generation failed with status {response.status_code}", "ERROR")
            log_test(f"Response: {response.text}", "ERROR")
            return False
        
        # Verify Content-Type
        content_type = response.headers.get('Content-Type', '')
        if 'application/pdf' not in content_type:
            log_test(f"❌ Invalid Content-Type: {content_type}, expected application/pdf", "ERROR")
            return False
        
        # Verify PDF content
        pdf_content = response.content
        if len(pdf_content) < 1000:  # PDF should be at least 1KB
            log_test(f"❌ PDF too small: {len(pdf_content)} bytes", "ERROR")
            return False
        
        # Check PDF header
        if not pdf_content.startswith(b'%PDF-'):
            log_test("❌ Invalid PDF header", "ERROR")
            return False
        
        log_test(f"✅ PDF generated successfully: {len(pdf_content)} bytes")
        log_test(f"✅ Content-Type: {content_type}")
        
    except requests.exceptions.RequestException as e:
        log_test(f"❌ PDF request failed: {str(e)}", "ERROR")
        return False
    
    log_test("✅ TEST 4 PASSED: PDF Generation Endpoint", "SUCCESS")
    return True

def main():
    """Run all critical fixes tests"""
    log_test("Starting Critical P0 Fixes Tests", "INFO")
    log_test(f"Base URL: {BASE_URL}", "INFO")
    log_test(f"API Base: {API_BASE}", "INFO")
    
    test_results = []
    
    try:
        # Test 1: Stripe Promo Code TEST100
        log_test("\n" + "="*60, "INFO")
        test1_result = test_stripe_promo_code_test100()
        test_results.append(("Stripe Promo Code TEST100", test1_result))
        
        # Test 2: Photo Upload with Cloudinary Fallback
        log_test("\n" + "="*60, "INFO")
        test2_result = test_photo_upload_cloudinary_fallback()
        test_results.append(("Photo Upload Cloudinary Fallback", test2_result))
        
        # Test 3: EDL and Pieces CRUD with Cache Busters
        log_test("\n" + "="*60, "INFO")
        test3_result = test_edl_pieces_crud_cache_busters()
        test_results.append(("EDL/Pieces CRUD Cache Busters", test3_result))
        
        # Test 4: PDF Generation (only if test 3 succeeded)
        log_test("\n" + "="*60, "INFO")
        if test3_result:
            test4_result = test_pdf_generation_endpoint(test3_result)
            test_results.append(("PDF Generation Endpoint", test4_result))
        else:
            log_test("Skipping PDF test due to previous failure", "ERROR")
            test_results.append(("PDF Generation Endpoint", False))
        
        # Summary
        log_test("\n" + "="*60, "INFO")
        log_test("CRITICAL FIXES TEST SUMMARY:", "INFO")
        log_test("="*60, "INFO")
        
        passed = 0
        total = len(test_results)
        
        for test_name, result in test_results:
            status = "✅ PASSED" if result else "❌ FAILED"
            log_test(f"{test_name}: {status}", "INFO")
            if result:
                passed += 1
        
        log_test("="*60, "INFO")
        log_test(f"OVERALL RESULT: {passed}/{total} tests passed", "INFO")
        
        if passed == total:
            log_test("🎉 ALL CRITICAL FIXES TESTS PASSED!", "SUCCESS")
            return True
        else:
            log_test(f"❌ {total - passed} test(s) failed", "ERROR")
            return False
        
    except Exception as e:
        log_test(f"Unexpected error: {str(e)}", "ERROR")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)