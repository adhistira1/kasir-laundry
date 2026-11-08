require("dotenv").config();

/*
 * Mengirim template WhatsApp Cloud API.
 * Buat dan minta persetujuan template laundry_selesai di WhatsApp Manager.
 * Template contoh dengan 4 variabel body:
 * "Halo {{1}}, laundry dengan nota {{2}} sudah selesai.
 * Total pembayaran {{3}}. Silakan ambil di Maha Laundry. Terima kasih."
 */
async function sendLaundryFinished({ phone, customerName, invoice, total }) {
  if (process.env.WHATSAPP_ENABLED !== "true") {
    return { skipped: true, reason: "WhatsApp belum diaktifkan di .env" };
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "laundry_selesai";
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "id";

  if (!token || !phoneNumberId) throw new Error("WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID belum diatur.");

  const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(total);
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: invoice },
            { type: "text", text: money }
          ]
        }]
      }
    })
  });

  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error?.message || "WhatsApp API gagal mengirim pesan.");
    error.details = result;
    throw error;
  }
  return result;
}

module.exports = { sendLaundryFinished };
