makeup-store/
├── index.html             # الصفحة الرئيسية
├── shop.html              # (formerly products.html) صفحة عرض كل المنتجات
├── products.html          # صفحة المنتج الواحد
├── cart.html              # صفحة سلة الشراء
├── checkout.html          # صفحة الدفع وتأكيد الطلب
├── dashboard.html         # لوحة تحكم لإدارة المتجر
├── login.html             # (جديد) صفحة تسجيل دخول المسؤول
├── css/
│   └── style.css          # ملف الأنماط المخصصة
├── js/
│   └── script.js          # ملف الجافاسكريبت الرئيسي
└── assets/
    └── images/            # مجلد لوضع صور المنتجات والبانرات


rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Products and Categories are publicly readable
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null; // ONLY logged-in users (admins) can write
    }

    match /categories/{categoryId} {
      allow read: if true;
      allow write: if request.auth != null; // ONLY logged-in users (admins) can write
    }

    // Anyone can create an order (place an order)
    // But only logged-in users (admins) can view, update, or delete them
    match /orders/{orderId} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }
  }
}

// NEW FIREBASE STORAGE RULES
service firebase.storage {
  match /b/{bucket}/o {
    // Allow admins to upload product images
    match /products/{allPaths=**} {
      allow read: if true; // Allow anyone to view images
      allow write: if request.auth != null; // Allow only admins to upload
    }
  }
}


<!-- password -->

admin@mail.com
admin123
<!--  -->
ayman@mail.com
ayman123
