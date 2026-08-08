const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// هات التوكن ده من @BotFather بعد ما تعمل بوت جديد، ومتحطوش أبدًا في كود الموقع نفسه
// طريقة الحفظ الآمنة (من الطرفية / terminal):
//   firebase functions:secrets:set TELEGRAM_BOT_TOKEN
const TELEGRAM_BOT_TOKEN = "8800012522:AAGNIm28oqlQBKFNqFuYVcKpEkpEaZhWEeM";

function decodeTelegramStartPayload(startValue) {
  if (!startValue) return null;
  const cleaned = String(startValue).trim();
  if (!cleaned.startsWith("teacher_")) return null;
  try {
    return decodeURIComponent(cleaned.replace(/^teacher_/, ""));
  } catch (error) {
    console.error("Invalid Telegram start payload:", error);
    return null;
  }
}

exports.telegramBotWebhook = functions
  .runWith({ secrets: ["TELEGRAM_BOT_TOKEN"] })
  .https.onRequest(async (req, res) => {
    const method = req.method || "GET";
    if (method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      return res.status(204).send("");
    }

    if (method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const update = req.body || {};
    const message = update.message || {};
    const text = message.text || "";
    const from = message.from || {};
    const chatId = message.chat && message.chat.id ? String(message.chat.id) : "";

    if (!chatId || !text || !String(text).startsWith("/start")) {
      return res.status(200).json({ ok: true, status: "ignored" });
    }

    const payload = String(text).replace(/^\/start\s*/i, "").trim();
    const teacherEmail = decodeTelegramStartPayload(payload);

    // Debug logging for the actual issue
    console.log("Telegram start payload:", { payload, teacherEmail, chatId, username: from.username || "" });

    if (!teacherEmail) {
      return res.status(200).json({ ok: true, status: "missing_teacher_reference" });
    }

    try {
      const teacherSnap = await db
        .collection("teachers")
        .where("email", "==", teacherEmail)
        .limit(1)
        .get();

      if (teacherSnap.empty) {
        return res.status(200).json({ ok: true, status: "teacher_not_found" });
      }

      const teacherDoc = teacherSnap.docs[0];
      await teacherDoc.ref.update({
        telegramChatId: chatId,
        telegramNotificationsEnabled: true,
        telegramLinkedAt: new Date().toISOString(),
        telegramUsername: from.username || "",
        telegramApprovalNotified: teacherDoc.data().telegramApprovalNotified || false
      });

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `✅ تم ربط حسابك بنجاح مع منصة مسار.\n\nسيصلك إشعار تلقائي عبر Telegram عند قبول حسابك.`
        })
      });

      return res.status(200).json({ ok: true, status: "linked" });
    } catch (error) {
      console.error("Telegram teacherlink error:", error);
      return res.status(500).json({ ok: false, error: "failed_to_link_teacher" });
    }
  });

exports.notifyTelegramNewLesson = functions
  .runWith({ secrets: ["TELEGRAM_BOT_TOKEN"] })
  .https.onRequest(async (req, res) => {
    // السماح من أي موقع أثناء الاختبار / الموقع الثابت / localhost
    const origin = req.headers.origin || "*";
    res.set("Access-Control-Allow-Origin", origin === "*" ? "*" : origin);
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const { chatId, courseTitle, lessonTitle } = req.body || {};
    if (!chatId || !lessonTitle) {
      return res.status(400).json({ ok: false, error: "بيانات ناقصة" });
    }

    const text =
      `📚 حصة جديدة على منصة مسار!\n\n` +
      `الكورس: ${courseTitle || ""}\n` +
      `الحصة: ${lessonTitle}\n\n` +
      `افتح المنصة عشان تتفرج عليها الآن.`;

    try {
      const tgRes = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
        }
      );
      const tgData = await tgRes.json();

      if (!tgData.ok) {
        // أشهر الأسباب: البوت مش Admin في القناة، أو chatId غلط
        return res.status(400).json({ ok: false, error: tgData.description });
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("Telegram send error:", err);
      return res.status(500).json({ ok: false, error: "فشل الاتصال بتليجرام" });
    }
  });
