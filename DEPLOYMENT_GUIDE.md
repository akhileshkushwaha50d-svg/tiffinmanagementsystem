# 🚀 Complete Deployment Guide / सम्पूर्ण डिप्लॉयमेंट गाइड
### Tiffin Management & Delivery Web Application (Dual-Stack Production Release)

इस गाइड में आपको इस एप्लीकेशन को इंटरनेट पर लाइव (Deploy) करने के सभी सबसे आसान, 100% मुफ़्त (Free) और प्रोफेशनल तरीके स्टेप-बाय-स्टेप मिलेंगे।

---

## 📋 Table of Contents / विषय सूची
1. [Architecture Overview / सिस्टम आर्किटेक्चर](#1-architecture-overview)
2. [Method 1: Render.com (Recommended Free 1-Click Deploy)](#2-method-1-rendercom-recommended-free)
3. [Method 2: Railway.app Instant Deployment](#3-method-2-railwayapp-instant-deployment)
4. [Method 3: Free Cloud Database (Neon / Supabase) + Any Host](#4-method-3-free-cloud-database-neon--supabase)
5. [Method 4: Docker & Docker Compose (1-Command VPS/Local Deploy)](#5-method-4-docker--docker-compose)
6. [Method 5: Python Zero-Dependency Deployment (Lightweight)](#6-method-5-python-zero-dependency-deployment)
7. [Default Login Credentials / डिफॉल्ट लॉगिन क्रेडेंशियल्स](#7-default-login-credentials)
8. [Troubleshooting & FAQ](#8-troubleshooting--faq)

---

## 1. Architecture Overview

यह प्रोजेक्ट **Dual-Stack (Node.js & Python)** आर्किटेक्चर पर बना है:

| कम्पोनेंट | टेक्नोलॉजी | पोर्ट | डेटाबेस विकल्प |
| :--- | :--- | :--- | :--- |
| **Node.js Stack** (Primary) | Node.js (ES Module), Express.js, Prisma ORM, Helmet, JWT, Bcrypt | `5000` (या `process.env.PORT`) | PostgreSQL 16 (Render, Neon, Supabase, Docker) |
| **Python Stack** (Alternative) | Python 3.9+ Standard Library (`http.server`, `sqlite3`, `hashlib`) | `5000` (या CLI `--port`) | SQLite (Zero External Pip Dependencies) |
| **Frontend SPA** | HTML5, CSS3 Modern Flex/Grid, Vanilla JavaScript, Responsive Mobile/Desktop | Backend द्वारा सर्व किया जाता है | दोनों बैकएंड के साथ 100% कम्पैटिबल |

> [!NOTE]
> Frontend और Backend दोनों एक ही सर्वर द्वारा सर्व होते हैं। इसलिए आपको अलग से कोई frontend होस्ट करने की आवश्यकता नहीं है; सिर्फ एक सर्विस डिप्लॉय करने पर पूरी वेबसाइट लाइव हो जाएगी!

---

## 2. Method 1: Render.com (Recommended Free)
### सबसे आसान और 100% मुफ़्त डिप्लॉयमेंट (Render Web Service + Free PostgreSQL)

Render.com फ्री टियर में Node.js वेब सर्विस और 1GB का PostgreSQL डेटाबेस देता है।

### Step 1: प्रोजेक्ट को GitHub पर अपलोड करें (Push to GitHub)
1. अपने GitHub अकाउंट पर एक नया रिपॉजिटरी बनाएं (जैसे: `tiffin-management-app`).
2. अपने कंप्यूटर टर्मिनल पर इस फोल्डर में निम्न कमांड चलाएं:
   ```bash
   git init
   git add .
   git commit -m "Initial production release of Tiffin Management Web App"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   git push -u origin main
   ```

### Step 2: Render पर Blueprint से 1-Click डिप्लॉय करें
इस प्रोजेक्ट में पहले से `render.yaml` फाइल मौजूद है।
1. **[Render.com](https://render.com/)** पर जाएं और GitHub से लॉगिन करें।
2. डैशबोर्ड पर **New +** बटन पर क्लिक करें और **Blueprint** चुनें।
3. अपनी GitHub रिपॉजिटरी को कनेक्ट करें।
4. Render अपने आप `render.yaml` को पढ़ लेगा और दो चीजें बनाएगा:
   - **PostgreSQL Database** (`tiffin-db`)
   - **Node Web Service** (`tiffin-delivery-platform`)
5. **Apply** पर क्लिक करें। Render डेटाबेस और सर्वर को अपने आप लिंक और बिल्ड कर देगा!

### Step 3: डेटाबेस स्कीमा और डेमो डेटा पुश करें (Database Seeding)
बिल्ड पूरा होने के बाद:
1. Render डैशबोर्ड पर अपनी Web Service पर क्लिक करें।
2. बायीं तरफ दिए गए **Shell** टैब पर क्लिक करें।
3. यह कमांड टाइप करें और Enter दबाएं:
   ```bash
   npx prisma db push && npx prisma db seed
   ```
4. आपकी लाइव वेबसाइट का URL ऊपर दिख जाएगा (उदा. `https://tiffin-delivery-platform.onrender.com`). इसे ब्राउज़र में खोलें और इस्तेमाल करें!

---

## 3. Method 2: Railway.app Instant Deployment
### तेज़ और ऑटोमैटिक डिप्लॉयमेंट

Railway.app भी GitHub से कनेक्ट होकर तुरंत डिप्लॉय करता है।

1. **[Railway.app](https://railway.app/)** पर जाएं और लॉगिन करें।
2. **New Project** -> **Deploy from GitHub repo** चुनें और अपनी रिपॉजिटरी सेलेक्ट करें।
3. **+ New** बटन दबाकर **Database** -> **Add PostgreSQL** जोड़ें।
4. अपनी वेब सर्विस की **Variables** सेटिंग्स में जाएं और `DATABASE_URL` को Railway के पोस्टग्रेएस वेरिएबल `${{Postgres.DATABASE_URL}}` से लिंक करें।
5. निम्नलिखित एनवायरनमेंट वेरिएबल्स सेट करें:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: `tiffin_super_secure_jwt_token_2026`
6. Railway में `railway.json` के अनुसार बिल्ड स्वतः शुरू हो जाएगा।

---

## 4. Method 3: Free Cloud Database (Neon / Supabase) + Any Host

यदि आप डेटाबेस को अलग और लाइफटाइम फ्री रखना चाहते हैं:

### A. Neon.tech (Free Serverless PostgreSQL)
1. **[Neon.tech](https://neon.tech/)** पर फ्री अकाउंट बनाएं।
2. नया प्रोजेक्ट बनाएं (जैसे `tiffin-db`).
3. Dashboard पर दी गई **Connection String** कॉपी करें:
   ```env
   DATABASE_URL="postgresql://username:password@ep-cool-fog-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```

### B. स्कीमा और डेटा को Neon में लोड करें
अपने लोकल कंप्यूटर या किसी भी टर्मिनल से चलाएं:
```bash
# Prisma स्कीमा को सीधे Neon डेटाबेस में पुश करें
DATABASE_URL="your-neon-connection-string" npx prisma db push

# डेमो अकाउंट्स और मेन्यू सीड करें
DATABASE_URL="your-neon-connection-string" npx prisma db seed
```

### C. वेब ऐप को कहीं भी होस्ट करें (Render, Vercel, Railway, Koyeb)
- होस्टिंग प्रोवाइडर पर `DATABASE_URL` में यही Neon का लिंक डाल दें और ऐप स्टार्ट करें।

---

## 5. Method 4: Docker & Docker Compose
### 1-कमांड में VPS या लोकल मशीन पर डिप्लॉय करें

अगर आपके पास कोई Linux VPS (Ubuntu, DigitalOcean, AWS EC2, Linode) या लोकल सिस्टम है जहाँ Docker इंस्टॉल है:

### सिर्फ 1 कमांड चलाएं:
```bash
docker compose up -d
```

### यह क्या करेगा?
1. **PostgreSQL 16** कंटेनर चलाएगा (`tiffin_postgres`).
2. `prisma/schema.sql` की मदद से सभी 18 टेबल्स, फॉरेन कीज और इन्डेक्सेस खुद-ब-खुद बना देगा।
3. **Node.js Web App** कंटेनर बिल्ड करके पोर्ट `5000` पर स्टार्ट कर देगा।

वेबसाइट खोलने के लिए ब्राउज़र में जाएं:
👉 `http://localhost:5000` (या `http://YOUR_SERVER_IP:5000`)

---

## 6. Method 5: Python Zero-Dependency Deployment
### बिना किसी पैकेज इंस्टॉलेशन के सबसे हल्का (Lightweight) डिप्लॉयमेंट

यदि आप बिना Node.js या बिना npm के सिर्फ Python से डिप्लॉय करना चाहते हैं:

```bash
# Python 3 से डायरेक्ट रन करें
python server.py --port 5000
```

या Docker के जरिए:
```bash
docker build -f Dockerfile.python -t tiffin-python .
docker run -d -p 5000:5000 -v $(pwd)/data:/app/data tiffin-python
```
- यह SQLite डेटाबेस (`data/tiffin.db`) का इस्तेमाल करता है।
- इसके लिए किसी भी `pip install` की जरूरत नहीं है!

---

## 7. Default Login Credentials
### टेस्टिंग और डेमो के लिए पहले से बने हुए अकाउंट्स

डेटाबेस सीड (`prisma db seed` या Python init) करने के बाद आप तुरंत इन क्रेडेंशियल्स से लॉगिन कर सकते हैं:

### 👨‍🎓 Student / Customer Account
- **Email**: `student@tiffin.com`
- **Password**: `student123`
- **Features**: Active 30-day subscription, ₹850 Wallet balance, 120 Reward Points, Dietary preferences set to Less Spicy, Today's Meals, QR code delivery verification.

### 👨‍🍳 Tiffin Business Owner Account
- **Email**: `owner@annapurnatiffin.com`
- **Password**: `owner123`
- **Business**: Shree Annapurna Pure Veg Tiffin & Meals (Indore)
- **Features**: Weekly menu manager, Today's deliveries with live status, Kitchen inventory tracking, Staff management & payroll, Grievance resolution system.

---

## 8. Troubleshooting & FAQ

#### Q: क्या डिप्लॉयमेंट के बाद डेटा डिलीट होगा?
- **नहीं।** Render PostgreSQL और Docker Compose दोनों में पर्सिस्टेंट वॉल्यूम (Persistent Volume) इस्तेमाल होता है, इसलिए सर्वर रीस्टार्ट होने पर भी डेटा सुरक्षित रहता है।

#### Q: Stop Meal का 2-घंटे का कटऑफ नियम सर्वर पर कैसे काम करता है?
- `server.js` और `server.py` दोनों में सर्वर टाइम को स्ट्रिक्ट इंडियन स्टैंडर्ड टाइम (IST UTC+05:30) में कन्वर्ट किया जाता है। इसलिए सर्वर दुनिया के किसी भी रीजन (US, Europe, Singapore) में होस्ट हो, कटऑफ हमेशा भारत के समय (IST) के अनुसार ही चेक होगा।

#### Q: अपना कस्टम डोमेन (Custom Domain) कैसे जोड़ें?
- Render या Railway डैशबोर्ड में **Settings** -> **Custom Domains** में जाएं।
- अपना डोमेन (जैसे: `mytiffinservice.com`) डालें और अपने DNS प्रोवाइडर (GoDaddy / Cloudflare / Namecheap) में CNAME रिकॉर्ड जोड़ें। SSL सर्टिफिकेट प्रोवाइडर द्वारा मुफ़्त में स्वतः जारी कर दिया जाएगा।

---
✨ **आपका प्रोजेक्ट अब पूरी तरह से प्रोडक्शन डिप्लॉयमेंट के लिए तैयार है!**
