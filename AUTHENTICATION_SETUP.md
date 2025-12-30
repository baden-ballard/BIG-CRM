# Authentication Setup Guide

Authentication has been successfully integrated into your BIG CRM application using Supabase Auth.

## What's Been Set Up

✅ **Supabase Client** - Updated to support authentication with session persistence  
✅ **Login Page** - Created at `/login` with email/password authentication  
✅ **Auth Provider** - React context for managing user sessions  
✅ **Protected Routes** - All routes except `/login` require authentication  
✅ **Logout Functionality** - Added to the Sidebar  
✅ **Session Management** - Automatic session refresh and persistence  

## How to Create Users

You have two options for creating users:

### Option 1: Create Users Manually (Recommended for initial setup)

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Authentication** > **Users**
3. Click **Add User** > **Create new user**
4. Enter the user's email and password
5. Click **Create User**

### Option 2: Enable Email Signup

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **Authentication** > **Providers**
3. Under **Email**, ensure **Enable Email Signup** is checked
4. Users can then sign up themselves at `/login` (you'll need to add a signup form)

## Testing Authentication

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to the app:**
   - Go to `http://localhost:3003`
   - You should be automatically redirected to `/login`

3. **Sign in:**
   - Use the email and password of a user you created in Supabase
   - After successful login, you'll be redirected to the dashboard

4. **Test logout:**
   - Click the "Sign Out" button in the sidebar
   - You should be redirected back to `/login`

## Features

- **Automatic Redirects**: Unauthenticated users are redirected to `/login`
- **Session Persistence**: User sessions persist across page refreshes
- **Protected Routes**: All pages except `/login` require authentication
- **User Display**: The sidebar shows the logged-in user's email
- **Secure Logout**: Properly clears the session and redirects to login

## Files Created/Modified

- `lib/supabase.ts` - Updated to support authentication
- `lib/auth.ts` - Authentication utility functions
- `app/login/page.tsx` - Login page component
- `components/AuthProvider.tsx` - Auth context provider
- `components/ProtectedLayout.tsx` - Route protection component
- `components/AppLayout.tsx` - Conditional sidebar rendering
- `components/Sidebar.tsx` - Added logout functionality
- `app/layout.tsx` - Integrated authentication providers

## Next Steps

1. **Create your first user** in the Supabase Dashboard
2. **Test the login flow** by accessing the app
3. **Customize the login page** if needed (styling, additional fields, etc.)
4. **Consider adding:**
   - Password reset functionality
   - User registration (if you enable email signup)
   - Role-based access control (if needed)
   - User profile management

## Troubleshooting

**Issue: Can't log in**
- Verify the user exists in Supabase Dashboard > Authentication > Users
- Check that email/password are correct
- Check browser console for error messages

**Issue: Redirect loop**
- Ensure your environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are set correctly
- Restart your dev server after changing environment variables

**Issue: Session not persisting**
- Check that cookies are enabled in your browser
- Verify `persistSession: true` is set in `lib/supabase.ts`

## Security Notes

- All authentication is handled securely by Supabase
- Sessions are stored in browser cookies
- Passwords are never stored in plain text (handled by Supabase)
- The `anon` key is safe to use in client-side code (it's public)
- Never expose your `service_role` key in client-side code

