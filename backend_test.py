#!/usr/bin/env python3
"""
Backend API Tests for État des Lieux Pro
Tests all API endpoints with the complete flow:
Create EDL -> Update pieces -> Add photos -> Mock payment -> Delete EDL
"""

import requests
import json
import base64
from datetime import datetime
import uuid

# Base URL from environment
BASE_URL = "https://property-inspect-16.preview.emergentagent.com/api"

# Test data
TEST_EDL_DATA = {
    "adresse": "123 Rue de la Paix, 75001 Paris",
    "type_logement": "T2",
    "type_edl": "Entrée",
    "nom_locataire": "Jean Dupont",
    "nom_proprietaire": "Marie Martin"
}

# Small base64 test image (1x1 pixel PNG)
TEST_IMAGE_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

class EDLAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.created_edl_id = None
        self.created_piece_ids = []
        self.created_photo_ids = []
        self.test_results = []

    def log_result(self, test_name, success, message, response_data=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'response_data': response_data
        })

    def test_create_edl(self):
        """Test POST /api/edl - Create new EDL"""
        try:
            print("\n=== Testing CREATE EDL ===")
            response = self.session.post(f"{BASE_URL}/edl", json=TEST_EDL_DATA)
            
            if response.status_code == 201:
                data = response.json()
                if 'id' in data and 'pieces' in data:
                    self.created_edl_id = data['id']
                    self.created_piece_ids = [piece['id'] for piece in data['pieces']]
                    
                    # Verify EDL structure
                    required_fields = ['id', 'adresse', 'type_logement', 'type_edl', 'nom_locataire', 'nom_proprietaire', 'pieces']
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if not missing_fields:
                        # Verify pieces were created based on housing type
                        expected_rooms = ['Entrée', 'Couloir', 'Salon', 'Chambre 1', 'Chambre 2', 'Cuisine', 'Salle de bain', 'WC']
                        created_rooms = [piece['nom'] for piece in data['pieces']]
                        
                        if all(room in created_rooms for room in expected_rooms):
                            self.log_result("Create EDL", True, f"EDL created successfully with {len(data['pieces'])} rooms", data)
                        else:
                            self.log_result("Create EDL", False, f"Missing expected rooms. Expected: {expected_rooms}, Got: {created_rooms}")
                    else:
                        self.log_result("Create EDL", False, f"Missing required fields: {missing_fields}")
                else:
                    self.log_result("Create EDL", False, "Response missing 'id' or 'pieces' field")
            else:
                self.log_result("Create EDL", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Create EDL", False, f"Exception: {str(e)}")

    def test_list_edls(self):
        """Test GET /api/edl - List all EDLs"""
        try:
            print("\n=== Testing LIST EDLs ===")
            response = self.session.get(f"{BASE_URL}/edl")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        # Check if our created EDL is in the list
                        edl_found = any(edl['id'] == self.created_edl_id for edl in data)
                        if edl_found:
                            # Verify stats fields
                            first_edl = data[0]
                            stats_fields = ['pieces_total', 'pieces_done', 'photos_count']
                            has_stats = all(field in first_edl for field in stats_fields)
                            
                            if has_stats:
                                self.log_result("List EDLs", True, f"Retrieved {len(data)} EDLs with stats", data)
                            else:
                                self.log_result("List EDLs", False, f"EDLs missing stats fields: {stats_fields}")
                        else:
                            self.log_result("List EDLs", False, "Created EDL not found in list")
                    else:
                        self.log_result("List EDLs", True, "Empty EDL list returned")
                else:
                    self.log_result("List EDLs", False, "Response is not a list")
            else:
                self.log_result("List EDLs", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("List EDLs", False, f"Exception: {str(e)}")

    def test_get_edl_by_id(self):
        """Test GET /api/edl/:id - Get specific EDL"""
        try:
            print("\n=== Testing GET EDL BY ID ===")
            if not self.created_edl_id:
                self.log_result("Get EDL by ID", False, "No EDL ID available for testing")
                return
                
            response = self.session.get(f"{BASE_URL}/edl/{self.created_edl_id}")
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['id', 'pieces', 'pieces_total', 'pieces_done', 'photos_count']
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    if data['id'] == self.created_edl_id:
                        self.log_result("Get EDL by ID", True, f"EDL retrieved with {data['pieces_total']} pieces", data)
                    else:
                        self.log_result("Get EDL by ID", False, "Wrong EDL ID returned")
                else:
                    self.log_result("Get EDL by ID", False, f"Missing required fields: {missing_fields}")
            else:
                self.log_result("Get EDL by ID", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Get EDL by ID", False, f"Exception: {str(e)}")

    def test_list_pieces(self):
        """Test GET /api/pieces?edl_id=xxx - List pieces for an EDL"""
        try:
            print("\n=== Testing LIST PIECES ===")
            if not self.created_edl_id:
                self.log_result("List Pieces", False, "No EDL ID available for testing")
                return
                
            response = self.session.get(f"{BASE_URL}/pieces?edl_id={self.created_edl_id}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    # Verify piece structure
                    first_piece = data[0]
                    required_fields = ['id', 'edl_id', 'nom', 'icon', 'statut']
                    missing_fields = [field for field in required_fields if field not in first_piece]
                    
                    if not missing_fields:
                        self.log_result("List Pieces", True, f"Retrieved {len(data)} pieces for EDL", data)
                    else:
                        self.log_result("List Pieces", False, f"Pieces missing required fields: {missing_fields}")
                else:
                    self.log_result("List Pieces", False, "No pieces returned or invalid format")
            else:
                self.log_result("List Pieces", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("List Pieces", False, f"Exception: {str(e)}")

    def test_update_piece(self):
        """Test PUT /api/pieces/:id - Update piece with inspection data"""
        try:
            print("\n=== Testing UPDATE PIECE ===")
            if not self.created_piece_ids:
                self.log_result("Update Piece", False, "No piece IDs available for testing")
                return
                
            piece_id = self.created_piece_ids[0]  # Use first piece
            update_data = {
                "donnees_json": {
                    "etat_general": "Bon",
                    "proprete": "Correct",
                    "observations": "Pièce en bon état"
                },
                "statut": "completed",
                "observations_generales": "Inspection terminée avec succès"
            }
            
            response = self.session.put(f"{BASE_URL}/pieces/{piece_id}", json=update_data)
            
            if response.status_code == 200:
                data = response.json()
                if data['statut'] == 'completed' and 'donnees_json' in data:
                    self.log_result("Update Piece", True, f"Piece updated successfully", data)
                else:
                    self.log_result("Update Piece", False, "Piece not updated correctly")
            else:
                self.log_result("Update Piece", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Update Piece", False, f"Exception: {str(e)}")

    def test_create_photo(self):
        """Test POST /api/photos - Upload photo"""
        try:
            print("\n=== Testing CREATE PHOTO ===")
            if not self.created_piece_ids or not self.created_edl_id:
                self.log_result("Create Photo", False, "No piece/EDL IDs available for testing")
                return
                
            photo_data = {
                "piece_id": self.created_piece_ids[0],
                "edl_id": self.created_edl_id,
                "data": TEST_IMAGE_BASE64,
                "legende": "Photo de test - État général de la pièce"
            }
            
            response = self.session.post(f"{BASE_URL}/photos", json=photo_data)
            
            if response.status_code == 201:
                data = response.json()
                if 'id' in data and data['piece_id'] == self.created_piece_ids[0]:
                    self.created_photo_ids.append(data['id'])
                    self.log_result("Create Photo", True, f"Photo created successfully", data)
                else:
                    self.log_result("Create Photo", False, "Photo response missing required fields")
            else:
                self.log_result("Create Photo", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Create Photo", False, f"Exception: {str(e)}")

    def test_list_photos(self):
        """Test GET /api/photos?piece_id=xxx - List photos for a piece"""
        try:
            print("\n=== Testing LIST PHOTOS ===")
            if not self.created_piece_ids:
                self.log_result("List Photos", False, "No piece IDs available for testing")
                return
                
            response = self.session.get(f"{BASE_URL}/photos?piece_id={self.created_piece_ids[0]}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    if len(data) > 0:
                        # Check if our created photo is in the list
                        photo_found = any(photo['piece_id'] == self.created_piece_ids[0] for photo in data)
                        if photo_found:
                            self.log_result("List Photos", True, f"Retrieved {len(data)} photos for piece", data)
                        else:
                            self.log_result("List Photos", False, "Created photo not found in list")
                    else:
                        self.log_result("List Photos", True, "No photos found for piece (expected if none created)")
                else:
                    self.log_result("List Photos", False, "Response is not a list")
            else:
                self.log_result("List Photos", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("List Photos", False, f"Exception: {str(e)}")

    def test_add_custom_room(self):
        """Test POST /api/pieces - Add custom room"""
        try:
            print("\n=== Testing ADD CUSTOM ROOM ===")
            if not self.created_edl_id:
                self.log_result("Add Custom Room", False, "No EDL ID available for testing")
                return
                
            custom_room_data = {
                "edl_id": self.created_edl_id,
                "nom": "Buanderie",
                "icon": "🧺"
            }
            
            response = self.session.post(f"{BASE_URL}/pieces", json=custom_room_data)
            
            if response.status_code == 201:
                data = response.json()
                if 'id' in data and data['nom'] == 'Buanderie' and data['edl_id'] == self.created_edl_id:
                    self.created_piece_ids.append(data['id'])
                    self.log_result("Add Custom Room", True, f"Custom room '{data['nom']}' created successfully", data)
                else:
                    self.log_result("Add Custom Room", False, "Custom room response missing required fields")
            else:
                self.log_result("Add Custom Room", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Add Custom Room", False, f"Exception: {str(e)}")

    def test_mock_payment(self):
        """Test POST /api/payment - Mock payment"""
        try:
            print("\n=== Testing MOCK PAYMENT ===")
            if not self.created_edl_id:
                self.log_result("Mock Payment", False, "No EDL ID available for testing")
                return
                
            payment_data = {
                "edl_id": self.created_edl_id
            }
            
            response = self.session.post(f"{BASE_URL}/payment", json=payment_data)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success') and 'payment_id' in data:
                    # Verify EDL is marked as paid
                    edl_response = self.session.get(f"{BASE_URL}/edl/{self.created_edl_id}")
                    if edl_response.status_code == 200:
                        edl_data = edl_response.json()
                        if edl_data.get('paid') and edl_data.get('stripe_payment_id'):
                            self.log_result("Mock Payment", True, f"Payment processed successfully: {data['payment_id']}", data)
                        else:
                            self.log_result("Mock Payment", False, "EDL not marked as paid after payment")
                    else:
                        self.log_result("Mock Payment", False, "Could not verify EDL payment status")
                else:
                    self.log_result("Mock Payment", False, "Payment response missing success or payment_id")
            else:
                self.log_result("Mock Payment", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Mock Payment", False, f"Exception: {str(e)}")

    def test_delete_photo(self):
        """Test DELETE /api/photos/:id - Delete a photo"""
        try:
            print("\n=== Testing DELETE PHOTO ===")
            if not self.created_photo_ids:
                self.log_result("Delete Photo", False, "No photo IDs available for testing")
                return
                
            photo_id = self.created_photo_ids[0]
            response = self.session.delete(f"{BASE_URL}/photos/{photo_id}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    # Verify photo is deleted
                    verify_response = self.session.get(f"{BASE_URL}/photos/{photo_id}")
                    if verify_response.status_code == 404:
                        self.log_result("Delete Photo", True, f"Photo {photo_id} deleted successfully", data)
                    else:
                        self.log_result("Delete Photo", False, "Photo still exists after deletion")
                else:
                    self.log_result("Delete Photo", False, "Delete response missing success field")
            else:
                self.log_result("Delete Photo", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Delete Photo", False, f"Exception: {str(e)}")

    def test_delete_edl(self):
        """Test DELETE /api/edl/:id - Delete EDL (cascade delete)"""
        try:
            print("\n=== Testing DELETE EDL (CASCADE) ===")
            if not self.created_edl_id:
                self.log_result("Delete EDL", False, "No EDL ID available for testing")
                return
                
            response = self.session.delete(f"{BASE_URL}/edl/{self.created_edl_id}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    # Verify EDL and associated data are deleted
                    edl_response = self.session.get(f"{BASE_URL}/edl/{self.created_edl_id}")
                    pieces_response = self.session.get(f"{BASE_URL}/pieces?edl_id={self.created_edl_id}")
                    photos_response = self.session.get(f"{BASE_URL}/photos?edl_id={self.created_edl_id}")
                    
                    if (edl_response.status_code == 404 and 
                        pieces_response.status_code == 200 and len(pieces_response.json()) == 0 and
                        photos_response.status_code == 200 and len(photos_response.json()) == 0):
                        self.log_result("Delete EDL", True, f"EDL {self.created_edl_id} and all associated data deleted successfully", data)
                    else:
                        self.log_result("Delete EDL", False, "EDL or associated data still exists after deletion")
                else:
                    self.log_result("Delete EDL", False, "Delete response missing success field")
            else:
                self.log_result("Delete EDL", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Delete EDL", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all tests in sequence"""
        print(f"🚀 Starting État des Lieux Pro API Tests")
        print(f"📍 Base URL: {BASE_URL}")
        print(f"⏰ Test started at: {datetime.now().isoformat()}")
        
        # Test sequence following the complete flow
        self.test_create_edl()
        self.test_list_edls()
        self.test_get_edl_by_id()
        self.test_list_pieces()
        self.test_update_piece()
        self.test_create_photo()
        self.test_list_photos()
        self.test_add_custom_room()
        self.test_mock_payment()
        self.test_delete_photo()
        self.test_delete_edl()
        
        # Summary
        print(f"\n{'='*60}")
        print("📊 TEST SUMMARY")
        print(f"{'='*60}")
        
        passed = sum(1 for result in self.test_results if result['success'])
        failed = len(self.test_results) - passed
        
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {(passed/len(self.test_results)*100):.1f}%")
        
        if failed > 0:
            print(f"\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"   ❌ {result['test']}: {result['message']}")
        
        print(f"\n⏰ Test completed at: {datetime.now().isoformat()}")
        return passed, failed

if __name__ == "__main__":
    tester = EDLAPITester()
    passed, failed = tester.run_all_tests()
    
    # Exit with error code if tests failed
    exit(0 if failed == 0 else 1)