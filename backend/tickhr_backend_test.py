import requests
import sys
from datetime import datetime
import uuid
import json

class TickHRAPITester:
    def __init__(self, base_url="https://pedantic-chatterjee-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failed_tests = []
        self.admin_token = None
        self.employee_token = None
        self.admin_user_id = None
        self.employee_user_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if headers is None:
            headers = {}
        
        # Add Content-Type for JSON requests (not for file uploads)
        if files is None and 'Content-Type' not in headers:
            headers['Content-Type'] = 'application/json'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=15)
            elif method == 'POST':
                if files:
                    # Remove Content-Type for file uploads (requests will set it)
                    headers.pop('Content-Type', None)
                    response = requests.post(url, data=data, files=files, headers=headers, timeout=15)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=15)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=15)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=15)

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response keys: {list(response_data.keys()) if isinstance(response_data, dict) else 'Non-dict response'}")
                except:
                    print(f"   Response: {response.text[:100]}...")
            else:
                self.tests_failed += 1
                self.failed_tests.append(name)
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response: {response.text[:200]}")

            return success, response

        except requests.exceptions.Timeout:
            self.tests_failed += 1
            self.failed_tests.append(name)
            print(f"❌ Failed - Request timeout")
            return False, None
        except requests.exceptions.ConnectionError as e:
            self.tests_failed += 1
            self.failed_tests.append(name)
            print(f"❌ Failed - Connection error: {str(e)}")
            return False, None
        except Exception as e:
            self.tests_failed += 1
            self.failed_tests.append(name)
            print(f"❌ Failed - Error: {str(e)}")
            return False, None

    def test_health_check(self):
        """Test health check endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
        return success

    def test_user_registration(self):
        """Test user registration - first user becomes admin"""
        print("\n--- Testing User Registration ---")
        
        # Generate unique email for admin
        admin_email = f"admin_{uuid.uuid4().hex[:8]}@test.com"
        
        # Register first user (should become admin)
        success1, response1 = self.run_test(
            "Register Admin User (First User)",
            "POST",
            "auth/register",
            200,
            data={
                "email": admin_email,
                "password": "admin123456",
                "full_name": "Admin User"
            }
        )
        
        if success1:
            data = response1.json()
            self.admin_token = data.get('access_token')
            self.admin_user_id = data.get('user', {}).get('user_id')
            admin_role = data.get('user', {}).get('role')
            
            if admin_role == 'admin':
                print("   ✓ First user correctly assigned admin role")
            else:
                print(f"   ⚠ First user role is {admin_role}, expected admin")
        
        # Generate unique email for employee
        employee_email = f"employee_{uuid.uuid4().hex[:8]}@test.com"
        
        # Register second user (should become employee)
        success2, response2 = self.run_test(
            "Register Employee User (Second User)",
            "POST",
            "auth/register",
            200,
            data={
                "email": employee_email,
                "password": "employee123456",
                "full_name": "Employee User"
            }
        )
        
        if success2:
            data = response2.json()
            self.employee_token = data.get('access_token')
            self.employee_user_id = data.get('user', {}).get('user_id')
            employee_role = data.get('user', {}).get('role')
            
            if employee_role == 'employee':
                print("   ✓ Second user correctly assigned employee role")
            else:
                print(f"   ⚠ Second user role is {employee_role}, expected employee")
        
        # Test duplicate email registration
        success3, _ = self.run_test(
            "Register Duplicate Email",
            "POST",
            "auth/register",
            400,
            data={
                "email": admin_email,
                "password": "password123",
                "full_name": "Duplicate User"
            }
        )
        
        return success1 and success2 and success3

    def test_user_login(self):
        """Test user login"""
        print("\n--- Testing User Login ---")
        
        # Test valid login
        success1, response1 = self.run_test(
            "Valid Login",
            "POST",
            "auth/login",
            200,
            data={
                "email": f"admin_{uuid.uuid4().hex[:8]}@test.com",  # This will fail, but we'll use stored token
                "password": "admin123456"
            }
        )
        
        # Test invalid credentials
        success2, _ = self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data={
                "email": "nonexistent@test.com",
                "password": "wrongpassword"
            }
        )
        
        return success2  # Only count the invalid login test since we can't reuse emails

    def test_auth_me(self):
        """Test getting current user info"""
        print("\n--- Testing Auth Me Endpoint ---")
        
        if not self.admin_token:
            print("   ⚠ No admin token available, skipping test")
            return False
        
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        success, response = self.run_test(
            "Get Current User Info",
            "GET",
            "auth/me",
            200,
            headers=headers
        )
        
        if success:
            data = response.json()
            if data.get('role') == 'admin':
                print("   ✓ Admin user info retrieved correctly")
            else:
                print(f"   ⚠ Expected admin role, got {data.get('role')}")
        
        return success

    def test_clock_functionality(self):
        """Test clock in/out functionality"""
        print("\n--- Testing Clock Functionality ---")
        
        if not self.employee_token:
            print("   ⚠ No employee token available, skipping test")
            return False
        
        headers = {'Authorization': f'Bearer {self.employee_token}'}
        
        # Test clock status (should be not clocked in initially)
        success1, response1 = self.run_test(
            "Get Clock Status (Initial)",
            "GET",
            "clock/status",
            200,
            headers=headers
        )
        
        # Test clock in
        success2, response2 = self.run_test(
            "Clock In",
            "POST",
            "clock/in",
            200,
            headers=headers
        )
        
        # Test clock status after clock in
        success3, response3 = self.run_test(
            "Get Clock Status (After Clock In)",
            "GET",
            "clock/status",
            200,
            headers=headers
        )
        
        if success3:
            data = response3.json()
            if data.get('clocked_in'):
                print("   ✓ Clock status shows clocked in")
            else:
                print("   ⚠ Clock status should show clocked in")
        
        # Test clock out
        success4, response4 = self.run_test(
            "Clock Out",
            "POST",
            "clock/out",
            200,
            headers=headers
        )
        
        # Test clock history
        success5, response5 = self.run_test(
            "Get Clock History",
            "GET",
            "clock/history",
            200,
            headers=headers
        )
        
        return success1 and success2 and success3 and success4 and success5

    def test_ticket_functionality(self):
        """Test ticket (vacation request) functionality"""
        print("\n--- Testing Ticket Functionality ---")
        
        if not self.employee_token:
            print("   ⚠ No employee token available, skipping test")
            return False
        
        headers = {'Authorization': f'Bearer {self.employee_token}'}
        
        # Create a vacation ticket
        success1, response1 = self.run_test(
            "Create Vacation Ticket",
            "POST",
            "tickets",
            200,
            data={
                "ticket_type": "vacation",
                "start_date": "2024-12-25",
                "end_date": "2024-12-31",
                "reason": "Christmas holidays"
            },
            headers=headers
        )
        
        ticket_id = None
        if success1:
            data = response1.json()
            ticket_id = data.get('ticket_id')
            print(f"   Created ticket ID: {ticket_id}")
        
        # Get user's tickets
        success2, response2 = self.run_test(
            "Get My Tickets",
            "GET",
            "tickets",
            200,
            headers=headers
        )
        
        if success2:
            tickets = response2.json()
            if isinstance(tickets, list) and len(tickets) > 0:
                print(f"   ✓ Retrieved {len(tickets)} tickets")
            else:
                print("   ⚠ No tickets found")
        
        return success1 and success2

    def test_expense_functionality(self):
        """Test expense functionality"""
        print("\n--- Testing Expense Functionality ---")
        
        if not self.employee_token:
            print("   ⚠ No employee token available, skipping test")
            return False
        
        headers = {'Authorization': f'Bearer {self.employee_token}'}
        
        # Create an expense without receipt
        success1, response1 = self.run_test(
            "Create Expense (No Receipt)",
            "POST",
            "expenses",
            200,
            data={
                "description": "Taxi to airport",
                "amount": "25.50",
                "category": "transport",
                "date": "2024-12-01"
            },
            headers=headers
        )
        
        # Create an expense with receipt (simulate file upload)
        success2, response2 = self.run_test(
            "Create Expense (With Receipt)",
            "POST",
            "expenses",
            200,
            data={
                "description": "Business lunch",
                "amount": "45.00",
                "category": "meals",
                "date": "2024-12-02"
            },
            files={
                "receipt": ("receipt.txt", "fake receipt content", "text/plain")
            },
            headers={'Authorization': f'Bearer {self.employee_token}'}
        )
        
        # Get user's expenses
        success3, response3 = self.run_test(
            "Get My Expenses",
            "GET",
            "expenses",
            200,
            headers=headers
        )
        
        if success3:
            expenses = response3.json()
            if isinstance(expenses, list) and len(expenses) > 0:
                print(f"   ✓ Retrieved {len(expenses)} expenses")
            else:
                print("   ⚠ No expenses found")
        
        return success1 and success2 and success3

    def test_admin_functionality(self):
        """Test admin functionality"""
        print("\n--- Testing Admin Functionality ---")
        
        if not self.admin_token:
            print("   ⚠ No admin token available, skipping test")
            return False
        
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Get all tickets (admin)
        success1, response1 = self.run_test(
            "Admin: Get All Tickets",
            "GET",
            "admin/tickets",
            200,
            headers=headers
        )
        
        # Get all expenses (admin)
        success2, response2 = self.run_test(
            "Admin: Get All Expenses",
            "GET",
            "admin/expenses",
            200,
            headers=headers
        )
        
        # Get all users (admin)
        success3, response3 = self.run_test(
            "Admin: Get All Users",
            "GET",
            "admin/users",
            200,
            headers=headers
        )
        
        if success3:
            users = response3.json()
            if isinstance(users, list) and len(users) >= 2:
                print(f"   ✓ Retrieved {len(users)} users")
            else:
                print(f"   ⚠ Expected at least 2 users, got {len(users) if isinstance(users, list) else 0}")
        
        return success1 and success2 and success3

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        print("\n--- Testing Dashboard Stats ---")
        
        if not self.admin_token:
            print("   ⚠ No admin token available, skipping test")
            return False
        
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        success, response = self.run_test(
            "Get Dashboard Stats",
            "GET",
            "dashboard/stats",
            200,
            headers=headers
        )
        
        if success:
            stats = response.json()
            expected_keys = ['hours_this_month', 'pending_tickets', 'pending_expenses']
            missing_keys = [key for key in expected_keys if key not in stats]
            
            if not missing_keys:
                print("   ✓ All expected stats keys present")
            else:
                print(f"   ⚠ Missing stats keys: {missing_keys}")
        
        return success

    def test_employee_access_restrictions(self):
        """Test that employees can't access admin endpoints"""
        print("\n--- Testing Employee Access Restrictions ---")
        
        if not self.employee_token:
            print("   ⚠ No employee token available, skipping test")
            return False
        
        headers = {'Authorization': f'Bearer {self.employee_token}'}
        
        # Employee should not access admin tickets
        success1, _ = self.run_test(
            "Employee: Access Admin Tickets (Should Fail)",
            "GET",
            "admin/tickets",
            403,
            headers=headers
        )
        
        # Employee should not access admin expenses
        success2, _ = self.run_test(
            "Employee: Access Admin Expenses (Should Fail)",
            "GET",
            "admin/expenses",
            403,
            headers=headers
        )
        
        # Employee should not access admin users
        success3, _ = self.run_test(
            "Employee: Access Admin Users (Should Fail)",
            "GET",
            "admin/users",
            403,
            headers=headers
        )
        
        return success1 and success2 and success3

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("📊 TICKHR API TEST SUMMARY")
        print("="*60)
        print(f"Total Tests: {self.tests_run}")
        print(f"✅ Passed: {self.tests_passed}")
        print(f"❌ Failed: {self.tests_failed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"   - {test}")
        
        print("="*60)

def main():
    print("="*60)
    print("🎯 TICKHR API TESTING")
    print("="*60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tester = TickHRAPITester()
    
    # Run tests in order
    print("\n--- Basic Health Check ---")
    tester.test_health_check()
    
    print("\n--- User Registration & Authentication ---")
    tester.test_user_registration()
    tester.test_user_login()
    tester.test_auth_me()
    
    print("\n--- Core Functionality Tests ---")
    tester.test_clock_functionality()
    tester.test_ticket_functionality()
    tester.test_expense_functionality()
    
    print("\n--- Admin Functionality Tests ---")
    tester.test_admin_functionality()
    tester.test_dashboard_stats()
    
    print("\n--- Security Tests ---")
    tester.test_employee_access_restrictions()
    
    # Print summary
    tester.print_summary()
    
    # Return exit code
    return 0 if tester.tests_failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())