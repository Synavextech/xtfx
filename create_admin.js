// Polyfill WebSocket for Node.js versions < 22 to prevent Supabase connection errors
if (typeof global.WebSocket === 'undefined') {
  try {
    global.WebSocket = require('ws');
  } catch (e) {
    // ws package not found
  }
}

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@xfx.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Extremt2020';

  console.log(`Setting up admin user: ${adminEmail}...`);

  // 1. Create the auth user if they don't exist
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Error listing users:", listError.message);
    process.exit(1);
  }

  let adminUser = usersData.users.find(u => u.email === adminEmail);

  if (!adminUser) {
    console.log("Admin user does not exist in Auth. Creating...");
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        username: 'admin',
        full_name: 'System Admin',
        phone: '+254724054460',
        country: 'US'
      }
    });

    if (createError) {
      console.error("Error creating admin user:", createError.message);
      process.exit(1);
    }

    adminUser = createData.user;
    console.log("Admin user created in Auth successfully. ID:", adminUser.id);
  } else {
    console.log("Admin user already exists in Auth. ID:", adminUser.id);
  }

  // 2. Wait a moment to let the trigger finish inserting the profile, or manually insert it
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', adminUser.id)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    console.error("Error checking profile:", profileError.message);
    process.exit(1);
  }

  if (!profile) {
    console.log("Profile not found. Creating profile manually...");
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: adminUser.id,
        username: 'admin',
        full_name: 'System Admin',
        email: adminEmail,
        phone: '+254724054460',
        country: 'US',
        role: 'admin',
        verified: true
      });
    if (insertError) {
      console.error("Error inserting profile manually:", insertError.message);
      process.exit(1);
    }
  } else {
    console.log("Profile exists. Updating role to 'admin' and verified to true...");
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin', verified: true })
      .eq('id', adminUser.id);

    if (updateError) {
      console.error("Error updating profile role:", updateError.message);
      process.exit(1);
    }
  }

  console.log("Admin setup completed successfully!");
}

main().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
