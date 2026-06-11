# Steakz Restaurant Management System

## Project Overview

Steakz is a multi-branch restaurant management backend system built using **Node.js**, **Express.js**, and a relational database such as **PostgreSQL**.

The system manages restaurant operations across a minimum of 5 branches while supporting multiple user roles with branch-based permissions and secure authentication.

---

# Restaurant Branches

The system must support a minimum of 5 branches:

1. London HQ
2. Mayfair
3. Manchester
4. Edinburgh
5. Birmingham
6. Glasgow

Each branch operates independently but is connected to the headquarters system.

---

# Core System Requirements

The system must:

* Allow customers to browse menus without registration
* Allow customers to place takeaway or delivery orders without logging in
* Require customers to log in before reserving tables
* Allow staff to only access information related to their branch
* Allow headquarters managers to monitor all branches
* Support role-based access control
* Support a minimum of 30 API endpoint routes

---

# User Roles

The system includes the following roles:

1. Customer (Open Area)
2. Chef
3. Waiter
4. Branch Manager
5. Headquarters Manager
6. Admin
7. Delivery Guy
8. Cashier
9. Host

---

# OPEN AREA

Customers can access the following WITHOUT authentication:

* Select branch
* View menu
* View available food items
* Place takeaway orders
* Place delivery orders
* Receive receipts

Customers MUST register and log in before:

* Booking a table
* Viewing reservation history
* Managing reservations

---

# User Stories

---

# 1. Customer User Stories

As a customer, I want to:

* Select a restaurant branch without logging in
* Browse the food menu without creating an account
* Place takeaway orders without logging in
* Place delivery orders without logging in
* Receive an order receipt
* Register and log in to reserve tables
* View my reservations after logging in

---

# 2. Chef User Stories

As a chef, I want to:

* View food orders from my assigned branch only
* Update order status to "Preparing"
* Update order status to "Ready"
* Notify waiters when food is ready

Restrictions:

* Chef from Branch A must NOT see orders from Branch B

---

# 3. Waiter User Stories

As a waiter, I want to:

* View ready orders from my branch
* Serve dine-in customers
* Hand delivery orders to delivery drivers
* Mark orders as served

Restrictions:

* Waiters must only access their branch data

---

# 4. Branch Manager User Stories

As a branch manager, I want to:

* View branch inventory
* View branch payroll information
* View branch revenue
* View branch expenses
* View employee count
* Monitor branch orders

Restrictions:

* Branch managers must only access their assigned branch

---

# 5. Headquarters Manager User Stories

As a headquarters manager, I want to:

* View inventory for all branches
* View payrolls for all branches
* View revenue statistics for all branches
* View employee statistics for all branches
* Compare branch performance
* Monitor all branch expenses

---

# 6. Admin User Stories

As an admin, I want to:

* Create new branches
* Delete users
* Modify user roles
* Create other admins
* Access all system data
* Manage branch assignments
* Activate or deactivate users

---

# 7. Delivery Guy User Stories

As a delivery driver, I want to:

* View delivery orders assigned to me
* Update delivery status
* Mark orders as delivered
* View customer delivery details

Restrictions:

* Delivery drivers only see assigned deliveries

---

# 8. Cashier User Stories

As a cashier, I want to:

* Process customer payments
* Generate receipts
* Confirm completed payments
* View branch payment history

Restrictions:

* Cashiers only manage payments for their branch

---

# 9. Host User Stories

As a host, I want to:

* View table reservations
* Assign customers to tables
* Manage reservation schedules
* Confirm customer arrivals

Restrictions:

* Hosts only manage reservations for their branch

---

# Recommended Backend Architecture

/backend
│
├── src
│   ├── controllers
│   ├── routes
│   ├── middleware
│   ├── services
│   ├── models
│   ├── config
│   ├── utils
│   ├── validations
│   └── database
│
├── package.json
├── .env
├── server.js
└── README.md

---

# Authentication & Security

The system must implement:

* JWT Authentication
* bcrypt password hashing
* Role-based authorization
* Branch-level access restrictions
* Protected routes
* Input validation
* Error handling middleware

---

# Suggested Database Tables

## Users

* id
* full_name
* email
* password
* role
* branch_id
* is_active

## Branches

* id
* name
* city
* address

## MenuItems

* id
* name
* description
* category
* price
* branch_id

## Orders

* id
* customer_name
* branch_id
* order_type
* status
* total_price

## OrderItems

* id
* order_id
* menu_item_id
* quantity

## Reservations

* id
* user_id
* branch_id
* reservation_date
* number_of_people

## Inventory

* id
* branch_id
* item_name
* quantity

## Payroll

* id
* employee_id
* salary

## Expenses

* id
* branch_id
* description
* amount

## Deliveries

* id
* order_id
* driver_id
* delivery_status

---

# Minimum API Requirements

The system must contain a minimum of 30 API routes.

---

# Suggested API Routes

## Authentication Routes

1. POST /api/auth/register
2. POST /api/auth/login
3. POST /api/auth/logout
4. GET /api/auth/profile

---

## Branch Routes

5. GET /api/branches
6. GET /api/branches/:id
7. POST /api/branches
8. PUT /api/branches/:id
9. DELETE /api/branches/:id

---

## Menu Routes

10. GET /api/menu
11. GET /api/menu/:id
12. POST /api/menu
13. PUT /api/menu/:id
14. DELETE /api/menu/:id

---

## Order Routes

15. POST /api/orders
16. GET /api/orders
17. GET /api/orders/:id
18. PUT /api/orders/:id/status
19. DELETE /api/orders/:id

---

## Reservation Routes

20. POST /api/reservations
21. GET /api/reservations
22. PUT /api/reservations/:id
23. DELETE /api/reservations/:id

---

## Chef Routes

24. GET /api/chef/orders
25. PUT /api/chef/orders/:id/preparing
26. PUT /api/chef/orders/:id/ready

---

## Waiter Routes

27. GET /api/waiter/ready-orders
28. PUT /api/waiter/orders/:id/served

---

## Delivery Routes

29. GET /api/delivery/orders
30. PUT /api/delivery/orders/:id/delivered

---

## Manager Routes

31. GET /api/manager/inventory
32. GET /api/manager/payroll
33. GET /api/manager/revenue
34. GET /api/manager/expenses

---

## Admin Routes

35. POST /api/admin/create-admin
36. PUT /api/admin/users/:id/role
37. DELETE /api/admin/users/:id
38. PUT /api/admin/users/:id/status

---

# Role-Based Access Rules

| Role                 | Access Scope                     |
| -------------------- | -------------------------------- |
| Customer             | Public ordering and reservations |
| Chef                 | Orders in assigned branch        |
| Waiter               | Ready orders in assigned branch  |
| Cashier              | Payments in assigned branch      |
| Host                 | Reservations in assigned branch  |
| Branch Manager       | Full data for assigned branch    |
| Headquarters Manager | Full data for all branches       |
| Delivery Guy         | Assigned deliveries only         |
| Admin                | Full system access               |

---

# Development Instructions for AI

Before generating or editing code:

* Analyze the existing project structure first
* Reuse existing architecture and naming conventions
* Do not rewrite working code unnecessarily
* Follow Express.js best practices
* Keep controllers modular
* Use middleware for authentication and authorization
* Ensure branch-level security is enforced

---

# Future Improvements

* Real-time notifications
* Online payments
* Mobile app
* Analytics dashboard
* QR code ordering
* Email notifications
* SMS confirmations

---

# Conclusion

The Steakz Restaurant Management System is designed to manage restaurant operations across multiple branches using a secure and scalable Express.js backend architecture with proper role-based access control and branch-level restrictions.

