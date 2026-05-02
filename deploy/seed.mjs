/* eslint-disable no-console */
/**
 * Idempotent seed for the Lotus Pharmacies CRM.
 * Inserts 6 users, 22 customers, 6 tags, 8 quick replies,
 * 22 conversations and ~44 messages.
 *
 * Uses pgcrypto's `crypt('pwd', gen_salt('bf', 10))` so the resulting hashes
 * are bcrypt-compatible with the api-server's bcryptjs.compare().
 *
 * Safe to run multiple times — every INSERT uses ON CONFLICT DO NOTHING
 * (or guards on count) so existing data is preserved.
 */

import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");

    // -------------------- USERS --------------------
    const users = [
      ["layla@lotuspharmacies.com", "Layla Hassan",   "admin", "admin123"],
      ["ahmed@lotuspharmacies.com", "Ahmed Mostafa",  "agent", "agent123"],
      ["sara@lotuspharmacies.com",  "Sara Ibrahim",   "agent", "agent123"],
      ["omar@lotuspharmacies.com",  "Omar Khaled",    "agent", "agent123"],
      ["nora@lotuspharmacies.com",  "Nora Adel",      "agent", "agent123"],
      ["youssef@lotuspharmacies.com","Youssef Tarek", "agent", "agent123"],
    ];
    for (const [email, name, role, pwd] of users) {
      await client.query(
        `INSERT INTO users (email, password_hash, name, role)
         VALUES ($1, crypt($2, gen_salt('bf', 10)), $3, $4)
         ON CONFLICT (email) DO NOTHING`,
        [email, pwd, name, role],
      );
    }

    // -------------------- TAGS --------------------
    const tags = [
      ["VIP",            "#FFD700"],
      ["Urgent",         "#DC2626"],
      ["Diabetic",       "#2563EB"],
      ["Delivery",       "#16A34A"],
      ["Insurance",      "#9333EA"],
      ["Follow-up",      "#F59E0B"],
    ];
    for (const [name, color] of tags) {
      await client.query(
        `INSERT INTO tags (name, color) VALUES ($1, $2)
         ON CONFLICT (name) DO NOTHING`,
        [name, color],
      );
    }

    // -------------------- QUICK REPLIES --------------------
    const replies = [
      ["Greeting",          "Hello! Welcome to Lotus Pharmacies. How can I help you today?"],
      ["Out of stock",      "I'm sorry, that item is currently out of stock. We expect a restock within 2–3 business days."],
      ["Delivery times",    "We deliver between 9 AM and 9 PM. Same-day delivery is available for orders placed before 6 PM."],
      ["Insurance accepted","We accept most major insurance providers. Please share your card and I'll verify coverage."],
      ["Prescription pickup","Your prescription is ready for pickup. Please bring a valid ID."],
      ["Refill reminder",   "Hi! This is a friendly reminder that it's time to refill your prescription."],
      ["Payment options",   "We accept cash, credit/debit cards, and digital wallets. Insurance copays are calculated at checkout."],
      ["Thank you",         "Thank you for choosing Lotus Pharmacies. We're here whenever you need us."],
    ];
    for (const [title, body] of replies) {
      await client.query(
        `INSERT INTO quick_replies (title, body) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [title, body],
      );
    }

    // -------------------- CUSTOMERS --------------------
    const branches = ["Downtown", "Westside", "North"];
    const customerTags = [
      ["VIP"], ["Diabetic"], ["Delivery"], ["VIP", "Insurance"],
      ["Urgent"], ["Follow-up"], ["Diabetic", "Delivery"], [],
      ["Insurance"], ["VIP", "Delivery"], ["Follow-up"], ["Urgent", "VIP"],
      ["Delivery"], ["Diabetic"], [], ["Insurance", "Follow-up"],
      ["VIP"], ["Delivery"], ["Urgent"], ["Diabetic"],
      ["Follow-up"], ["VIP", "Diabetic"],
    ];
    const names = [
      "Mariam Ahmed", "Khaled Mahmoud", "Fatma Saleh", "Mohamed Hany",
      "Aya Farouk", "Tamer Wahid", "Hana Magdy", "Karim Reda",
      "Salma Nabil", "Hassan Yousry", "Reem Adel", "Bassem Saad",
      "Dina Elsayed", "Mostafa Osman", "Lina Zaki", "Sherif Anwar",
      "Yara Hossam", "Ramy Fouad", "Heba Sami", "Tarek Ali",
      "Rana Hisham", "Ehab Galal",
    ];
    const customerIds = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const phone = `+2010${String(10000000 + i * 137).padStart(8, "0")}`;
      const branch = branches[i % branches.length];
      const tagsArr = customerTags[i] ?? [];
      const notes = i % 3 === 0 ? "Prefers SMS notifications." : null;
      const rxNotes = i % 4 === 0 ? "Allergic to penicillin." : null;

      const r = await client.query(
        `INSERT INTO customers (name, phone, branch, tags, notes, prescription_notes)
         SELECT $1, $2, $3, $4, $5, $6
         WHERE NOT EXISTS (SELECT 1 FROM customers WHERE phone = $2)
         RETURNING id`,
        [name, phone, branch, tagsArr, notes, rxNotes],
      );

      let id;
      if (r.rows.length > 0) {
        id = r.rows[0].id;
      } else {
        const existing = await client.query(
          "SELECT id FROM customers WHERE phone = $1",
          [phone],
        );
        id = existing.rows[0].id;
      }
      customerIds.push(id);
    }

    // -------------------- CONVERSATIONS --------------------
    const agentEmails = [
      "ahmed@lotuspharmacies.com",
      "sara@lotuspharmacies.com",
      "omar@lotuspharmacies.com",
      "nora@lotuspharmacies.com",
      "youssef@lotuspharmacies.com",
    ];
    const agentRows = await client.query(
      `SELECT id, email FROM users WHERE email = ANY($1::text[])`,
      [agentEmails],
    );
    const agentIdByEmail = Object.fromEntries(
      agentRows.rows.map((r) => [r.email, r.id]),
    );

    const sampleSnippets = [
      "Hi, I need to refill my prescription for metformin.",
      "When will my order be delivered?",
      "Can you check if you have insulin in stock?",
      "Thanks for the quick response!",
      "I have a question about my insurance coverage.",
      "Is the pharmacy open on Friday?",
      "Could you confirm the delivery address?",
      "I'd like to schedule a refill reminder.",
      "Do you offer home blood pressure monitors?",
      "I'm following up on my last order.",
    ];
    const statuses = ["open", "open", "open", "pending", "resolved"];

    // Skip if conversations already seeded
    const cvCount = await client.query("SELECT COUNT(*) FROM conversations");
    if (Number(cvCount.rows[0].count) === 0) {
      for (let i = 0; i < customerIds.length; i++) {
        const customerId = customerIds[i];
        const agentEmail = agentEmails[i % agentEmails.length];
        const agentId = agentIdByEmail[agentEmail];
        const status = statuses[i % statuses.length];
        const lastMsg = sampleSnippets[i % sampleSnippets.length];
        const cTags = i % 2 === 0 ? ["Follow-up"] : [];
        const minutesAgo = (i + 1) * 17;

        const conv = await client.query(
          `INSERT INTO conversations
             (customer_id, assigned_agent_id, status, tags,
              last_message, last_message_at, unread_count, resolved_at)
           VALUES ($1, $2, $3, $4, $5,
                   NOW() - ($6 || ' minutes')::interval, $7, $8)
           RETURNING id`,
          [
            customerId,
            agentId,
            status,
            cTags,
            lastMsg,
            String(minutesAgo),
            i % 3,
            status === "resolved" ? new Date() : null,
          ],
        );
        const convId = conv.rows[0].id;

        // 2 messages per conversation: one from customer, one from agent
        await client.query(
          `INSERT INTO messages
             (conversation_id, sender_id, sender_type, body, status, created_at)
           VALUES
             ($1, NULL,  'customer', $2, 'delivered',
                NOW() - ($3 || ' minutes')::interval),
             ($1, $4,    'agent',    $5, 'sent',
                NOW() - ($6 || ' minutes')::interval)`,
          [
            convId,
            sampleSnippets[(i + 3) % sampleSnippets.length],
            String(minutesAgo + 5),
            agentId,
            lastMsg,
            String(minutesAgo),
          ],
        );
      }
    }

    await client.query("COMMIT");
    console.log("✓ Seed complete.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("✗ Seed failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
