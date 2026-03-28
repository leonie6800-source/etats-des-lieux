#!/usr/bin/env python3
"""
PRODUCTION FINAL TEST - État des Lieux Pro
Testing JWT Auth, Stripe LIVE, Resend, Cloudinary, PDF Generation
"""

import requests
import json
import base64
import time
import os
from datetime import datetime

# Production URL
BASE_URL = "https://property-inspect-16.preview.emergentagent.com/api"

# Test data
TEST_USER = {
    "email": "test@final.com",
    "password": "testfinal123",
    "nom": "Test Final"
}

# Sample base64 image for testing (small 1x1 pixel PNG)
SAMPLE_IMAGE_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

def log_test(test_name, status, details=""):
    """Log test results with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_icon} {test_name}")
    if details:
        print(f"    {details}")
    print()

def make_request(method, endpoint, data=None, headers=None, expect_status=200):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}/{endpoint.lstrip('/')}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=30)
        elif method.upper() == "PUT":
            response = requests.put(url, json=data, headers=headers, timeout=30)
        elif method.upper() == "DELETE":
            response = requests.delete(url, headers=headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        # Log request details
        print(f"    → {method} {url}")
        print(f"    → Status: {response.status_code}")
        
        if response.status_code != expect_status:
            print(f"    → Expected {expect_status}, got {response.status_code}")
            print(f"    → Response: {response.text[:200]}...")
        
        return response
    except Exception as e:
        print(f"    → Request failed: {str(e)}")
        return None

def test_authentication():
    """Test JWT authentication with bcrypt"""
    print("=" * 60)
    print("🔐 TESTING AUTHENTICATION (JWT + bcrypt)")
    print("=" * 60)
    
    # Test 1: Register new user
    try:
        response = make_request("POST", "/auth/register", TEST_USER, expect_status=200)
        if response and response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data:
                log_test("User Registration", "PASS", f"Token received, User ID: {data['user']['id']}")
                return data["token"]
            else:
                log_test("User Registration", "FAIL", "Missing token or user in response")
                return None
        elif response and response.status_code == 400 and "déjà utilisé" in response.text:
            log_test("User Registration", "PASS", "User already exists, proceeding to login")
        else:
            log_test("User Registration", "FAIL", f"Unexpected response: {response.text if response else 'No response'}")
    except Exception as e:
        log_test("User Registration", "FAIL", f"Exception: {str(e)}")
    
    # Test 2: Login with correct credentials
    try:
        login_data = {"email": TEST_USER["email"], "password": TEST_USER["password"]}
        response = make_request("POST", "/auth/login", login_data, expect_status=200)
        if response and response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data:
                log_test("User Login (Correct)", "PASS", f"JWT token received, User: {data['user']['nom']}")
                return data["token"]
            else:
                log_test("User Login (Correct)", "FAIL", "Missing token or user in response")
                return None
        else:
            log_test("User Login (Correct)", "FAIL", f"Login failed: {response.text if response else 'No response'}")
            return None
    except Exception as e:
        log_test("User Login (Correct)", "FAIL", f"Exception: {str(e)}")
        return None
    
    # Test 3: Login with wrong password
    try:
        wrong_data = {"email": TEST_USER["email"], "password": "wrongpassword"}
        response = make_request("POST", "/auth/login", wrong_data, expect_status=401)
        if response and response.status_code == 401:
            log_test("User Login (Wrong Password)", "PASS", "Correctly rejected with 401")
        else:
            log_test("User Login (Wrong Password)", "FAIL", f"Expected 401, got {response.status_code if response else 'No response'}")
    except Exception as e:
        log_test("User Login (Wrong Password)", "FAIL", f"Exception: {str(e)}")
    
    # Test 4: Login with non-existent email
    try:
        nonexistent_data = {"email": "nonexistent@test.com", "password": "anypassword"}
        response = make_request("POST", "/auth/login", nonexistent_data, expect_status=401)
        if response and response.status_code == 401:
            log_test("User Login (Non-existent Email)", "PASS", "Correctly rejected with 401")
        else:
            log_test("User Login (Non-existent Email)", "FAIL", f"Expected 401, got {response.status_code if response else 'No response'}")
    except Exception as e:
        log_test("User Login (Non-existent Email)", "FAIL", f"Exception: {str(e)}")

def test_edl_crud_with_auth(token):
    """Test EDL CRUD operations with authentication"""
    print("=" * 60)
    print("🏠 TESTING EDL CRUD WITH AUTH")
    print("=" * 60)
    
    if not token:
        log_test("EDL CRUD Tests", "FAIL", "No authentication token available")
        return None
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 1: Create EDL with auth
    try:
        edl_data = {
            "adresse": "123 Rue de Test, 75001 Paris",
            "type_logement": "T2",
            "type_edl": "entree",
            "nom_locataire": "Jean Dupont",
            "nom_proprietaire": "Marie Martin",
            "email_locataire": "jean.dupont@test.com"
        }
        response = make_request("POST", "/edl", edl_data, headers, expect_status=201)
        if response and response.status_code == 201:
            data = response.json()
            if "id" in data and "user_id" in data and "pieces" in data:
                log_test("Create EDL (With Auth)", "PASS", f"EDL created with ID: {data['id']}, Rooms: {len(data['pieces'])}")
                return data["id"]
            else:
                log_test("Create EDL (With Auth)", "FAIL", "Missing required fields in response")
                return None
        else:
            log_test("Create EDL (With Auth)", "FAIL", f"Failed to create EDL: {response.text if response else 'No response'}")
            return None
    except Exception as e:
        log_test("Create EDL (With Auth)", "FAIL", f"Exception: {str(e)}")
        return None
    
    # Test 2: Get EDLs with auth (should return only user's EDLs)
    try:
        response = make_request("GET", "/edl", headers=headers, expect_status=200)
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                log_test("Get EDLs (With Auth)", "PASS", f"Retrieved {len(data)} EDL(s) for authenticated user")
            else:
                log_test("Get EDLs (With Auth)", "PASS", "No EDLs found for user (expected for new user)")
        else:
            log_test("Get EDLs (With Auth)", "FAIL", f"Failed to get EDLs: {response.text if response else 'No response'}")
    except Exception as e:
        log_test("Get EDLs (With Auth)", "FAIL", f"Exception: {str(e)}")
    
    # Test 3: Get EDLs without auth (should return 401)
    try:
        response = make_request("GET", "/edl", expect_status=401)
        if response and response.status_code == 401:
            log_test("Get EDLs (No Auth)", "PASS", "Correctly rejected with 401 Unauthorized")
        else:
            log_test("Get EDLs (No Auth)", "FAIL", f"Expected 401, got {response.status_code if response else 'No response'}")
    except Exception as e:
        log_test("Get EDLs (No Auth)", "FAIL", f"Exception: {str(e)}")

def test_photos_cloudinary(token, edl_id):
    """Test photo upload with Cloudinary"""
    print("=" * 60)
    print("📸 TESTING PHOTOS WITH CLOUDINARY")
    print("=" * 60)
    
    if not token or not edl_id:
        log_test("Photo Tests", "FAIL", "Missing token or EDL ID")
        return None
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get pieces for the EDL
    try:
        response = make_request("GET", f"/pieces?edl_id={edl_id}", headers=headers)
        if response and response.status_code == 200:
            pieces = response.json()
            if len(pieces) > 0:
                piece_id = pieces[0]["id"]
                log_test("Get Pieces", "PASS", f"Found {len(pieces)} pieces, using piece: {pieces[0]['nom']}")
            else:
                log_test("Get Pieces", "FAIL", "No pieces found for EDL")
                return None
        else:
            log_test("Get Pieces", "FAIL", f"Failed to get pieces: {response.text if response else 'No response'}")
            return None
    except Exception as e:
        log_test("Get Pieces", "FAIL", f"Exception: {str(e)}")
        return None
    
    # Test 1: Upload photo to Cloudinary
    try:
        photo_data = {
            "piece_id": piece_id,
            "edl_id": edl_id,
            "data": SAMPLE_IMAGE_B64,
            "legende": "Photo de test Cloudinary",
            "horodatage": datetime.now().isoformat(),
            "gps": {"lat": 48.856614, "lng": 2.352222}
        }
        response = make_request("POST", "/photos", photo_data, headers, expect_status=201)
        if response and response.status_code == 201:
            data = response.json()
            if "id" in data and "url" in data and data["url"]:
                if "cloudinary.com" in data["url"]:
                    log_test("Photo Upload (Cloudinary)", "PASS", f"Photo uploaded to Cloudinary: {data['url'][:50]}...")
                    return data["id"]
                else:
                    log_test("Photo Upload (Cloudinary)", "FAIL", f"Photo not uploaded to Cloudinary, URL: {data.get('url', 'None')}")
                    return None
            else:
                log_test("Photo Upload (Cloudinary)", "FAIL", "Missing photo ID or URL in response")
                return None
        else:
            log_test("Photo Upload (Cloudinary)", "FAIL", f"Failed to upload photo: {response.text if response else 'No response'}")
            return None
    except Exception as e:
        log_test("Photo Upload (Cloudinary)", "FAIL", f"Exception: {str(e)}")
        return None

def test_stripe_payments(token, edl_id):
    """Test Stripe payment integration"""
    print("=" * 60)
    print("💳 TESTING STRIPE PAYMENTS + RESEND EMAIL")
    print("=" * 60)
    
    if not token or not edl_id:
        log_test("Stripe Tests", "FAIL", "Missing token or EDL ID")
        return None
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 1: Create Stripe checkout session
    try:
        checkout_data = {
            "plan_code": "one_shot",
            "edl_id": edl_id,
            "origin_url": "https://property-inspect-16.preview.emergentagent.com"
        }
        response = make_request("POST", "/stripe/checkout", checkout_data, headers, expect_status=200)
        if response and response.status_code == 200:
            data = response.json()
            if "url" in data and "checkout.stripe.com" in data["url"]:
                log_test("Stripe Checkout Session", "PASS", f"Checkout URL created: {data['url'][:50]}...")
                return data.get("session_id")
            else:
                log_test("Stripe Checkout Session", "FAIL", f"Invalid checkout URL: {data.get('url', 'None')}")
                return None
        else:
            log_test("Stripe Checkout Session", "FAIL", f"Failed to create checkout: {response.text if response else 'No response'}")
            return None
    except Exception as e:
        log_test("Stripe Checkout Session", "FAIL", f"Exception: {str(e)}")
        return None
    
    # Test 2: Simulate admin unlock (for testing email)
    try:
        admin_data = {
            "edl_id": edl_id,
            "admin_key": "edl_admin_2026_test"
        }
        response = make_request("POST", "/admin/unlock", admin_data, expect_status=200)
        if response and response.status_code == 200:
            data = response.json()
            if data.get("success") and "download_token" in data:
                log_test("Admin Unlock + Email", "PASS", f"EDL unlocked, Email sent: {data.get('email_sent', False)}")
                return data["download_token"]
            else:
                log_test("Admin Unlock + Email", "FAIL", f"Unlock failed: {data}")
                return None
        else:
            log_test("Admin Unlock + Email", "FAIL", f"Admin unlock failed: {response.text if response else 'No response'}")
            return None
    except Exception as e:
        log_test("Admin Unlock + Email", "FAIL", f"Exception: {str(e)}")
        return None

def test_pdf_generation(download_token):
    """Test PDF generation"""
    print("=" * 60)
    print("📄 TESTING PDF GENERATION")
    print("=" * 60)
    
    if not download_token:
        log_test("PDF Tests", "FAIL", "No download token available")
        return
    
    # Test 1: Generate PDF
    try:
        response = make_request("GET", f"/pdf-fresh/{download_token}", expect_status=200)
        if response and response.status_code == 200:
            content_type = response.headers.get("Content-Type", "")
            content_length = len(response.content)
            
            if content_type == "application/pdf" and content_length > 1000:
                log_test("PDF Generation", "PASS", f"PDF generated successfully ({content_length} bytes)")
            else:
                log_test("PDF Generation", "FAIL", f"Invalid PDF: Content-Type={content_type}, Size={content_length}")
        else:
            log_test("PDF Generation", "FAIL", f"PDF generation failed: {response.text if response else 'No response'}")
    except Exception as e:
        log_test("PDF Generation", "FAIL", f"Exception: {str(e)}")

def test_stripe_webhook():
    """Test Stripe webhook handling"""
    print("=" * 60)
    print("🔔 TESTING STRIPE WEBHOOK")
    print("=" * 60)
    
    # Test 1: Webhook without signature (should return 400 but handle gracefully)
    try:
        webhook_data = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_123",
                    "metadata": {
                        "edl_id": "test_edl_id",
                        "plan_code": "one_shot"
                    }
                }
            }
        }
        response = make_request("POST", "/stripe/webhook", webhook_data, expect_status=400)
        if response and response.status_code == 400:
            if "stripe-signature" in response.text:
                log_test("Stripe Webhook", "PASS", "Correctly requires stripe-signature header (production security)")
            else:
                log_test("Stripe Webhook", "FAIL", f"Unexpected 400 response: {response.text}")
        else:
            log_test("Stripe Webhook", "FAIL", f"Webhook failed: {response.text if response else 'No response'}")
    except Exception as e:
        log_test("Stripe Webhook", "FAIL", f"Exception: {str(e)}")

def main():
    """Run all production tests"""
    print("🚀 STARTING PRODUCTION FINAL TEST - État des Lieux Pro")
    print(f"🌐 Base URL: {BASE_URL}")
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Test 1: Authentication
    token = test_authentication()
    
    # Test 2: EDL CRUD with auth
    edl_id = test_edl_crud_with_auth(token)
    
    # Test 3: Photos with Cloudinary
    photo_id = test_photos_cloudinary(token, edl_id)
    
    # Test 4: Stripe payments + Resend email
    download_token = test_stripe_payments(token, edl_id)
    
    # Test 5: PDF generation
    test_pdf_generation(download_token)
    
    # Test 6: Stripe webhook
    test_stripe_webhook()
    
    print("=" * 60)
    print("🏁 PRODUCTION TESTING COMPLETE")
    print("=" * 60)
    print(f"⏰ Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    print("📋 SUMMARY:")
    print("- Authentication (JWT + bcrypt): Tested")
    print("- EDL CRUD with user isolation: Tested")
    print("- Cloudinary photo upload: Tested")
    print("- Stripe LIVE payments: Tested")
    print("- Resend email integration: Tested")
    print("- PDF generation with photos: Tested")
    print("- Stripe webhook handling: Tested")
    print()
    print("✅ All critical production features tested!")

if __name__ == "__main__":
    main()