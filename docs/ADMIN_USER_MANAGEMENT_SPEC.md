# Project Specification: Admin User Management System

## 1. Objective
To provide **Super Admins** with a robust interface to manage internal staff accounts, including role assignment, permission control, and account status monitoring. This system ensures secure and granular access control across the administrative dashboard.

## 2. User Roles & Access Control
The system utilizes the `role` column in the `users` table to differentiate between various administrative levels:

| Role | Description | Access Level |
| :--- | :--- | :--- |
| **Super Admin** | Full system owner. | Can manage other admins, settings, and all modules. |
| **Manager** | Store operations lead. | Can manage products, categories, orders, and view reports. |
| **Cashier** | Front-line sales. | Access to order processing and point-of-sale features. |
| **Support** | Customer service. | Access to live chat, reviews, and customer profiles. |

## 3. Core Features (CRUD)

### 3.1 Admin User List (Read)
- **Search & Filter**: Search by name/email; filter by role or status (Active/Suspended).
- **Table View**: Display Name, Email, Role, Status, and Last Login (optional).
- **Quick Actions**: Toggle account status directly from the list.

### 3.2 Create Admin (Create)
- **Form Fields**: Full Name, Email, Password, Phone, Role Selection, Initial Status.
- **Validation**: Unique email check, password strength requirements, mandatory role selection.
- **Notification**: Option to send welcome email with login credentials (Phase 2).

### 3.3 Edit Admin (Update)
- **Profile Updates**: Change name, phone, or avatar.
- **Role/Permission Migration**: Change an admin's role (e.g., promote Manager to Super Admin).
- **Security**: Option to reset password for the user.
- **Account Status**: Suspend/Activate account.

### 3.4 Delete Admin (Delete)
- **Soft Delete**: Preferably use Laravel SoftDeletes to preserve audit trails.
- **Restriction**: A Super Admin cannot delete their own account.

## 4. UX & UI Design Principles
Following the existing **Romantic Pink & Modern Ecommerce** aesthetic:
- **Mobile-First**: Fully responsive tables and forms.
- **Interactive Feedback**: Loading states on buttons, toast notifications for success/error.
- **Confirmation Modals**: Required for destructive actions like suspension or deletion.
- **MUI Components**: Utilize `DataGrid` or `Table`, `Dialog` for forms, and `Chip` for status/role badges.

## 5. Technical Implementation Details

### 5.1 Backend (Laravel)
- **Controller**: `App\Http\Controllers\Admin\AdminUserController`
- **Middleware**: `auth`, `admin` (existing), and a new `role:super_admin` check for this specific module.
- **Routes**:
    - `GET /admin/users` (Index)
    - `POST /admin/users` (Store)
    - `PATCH /admin/users/{user}` (Update)
    - `DELETE /admin/users/{user}` (Destroy)

### 5.2 Frontend (Inertia.js + React)
- **Pages**:
    - `Admin/Users/Index.jsx`: Main listing page.
    - `Admin/Users/Create.jsx` (or Modal): Form for new staff.
    - `Admin/Users/Edit.jsx` (or Modal): Management interface for existing staff.

### 5.3 Database Requirements
Existing columns in `users` table to be utilized:
- `role` (string)
- `status` (string: active/suspended)
- `permissions` (json)
- `phone` (string)
- `avatar` (string)

## 6. Security Considerations
- **Authorization**: Strict policy check to ensure only `super_admin` can access these routes.
- **Audit Logs**: (Recommended) Track who created/modified which admin account.
- **Password Hashing**: Ensure all passwords are encrypted using `Bcrypt`.
