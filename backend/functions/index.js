const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

// Initialize Firebase Admin SDK (uses env or service account when deployed)
admin.initializeApp();

const db = admin.database();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'backend-functions' });
});

// Get client by id
app.get('/clients/:id', async (req, res) => {
  try {
    const snap = await db.ref(`/clients/${req.params.id}`).get();
    res.json(snap.val());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Create client
app.post('/clients', async (req, res) => {
  try {
    const ref = await db.ref('/clients').push(req.body);
    res.json({ id: ref.key });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Predict risk (placeholder)
app.post('/predict', async (req, res) => {
  try {
    // TODO: Integrate ML model or call external inference service
    // For now return a placeholder random risk score
    const risk = Math.random();
    res.json({ risk });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Expose Express app as single Cloud Function
exports.api = functions.https.onRequest(app);
