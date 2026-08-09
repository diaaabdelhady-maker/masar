const functions = require("firebase-functions");

// هات التوكن ده من @BotFather بعد ما تعمل بوت جديد، ومتحطوش أبدًا في كود الموقع نفسه
// طريقة الحفظ الآمنة (من الطرفية / terminal):
//   firebase functions:secrets:set TELEGRAM_BOT_TOKEN
const TELEGRAM_BOT_TOKEN = "8800012522:AAGNIm28oqlQBKFNqFuYVcKpEkpEaZhWEeM";

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
