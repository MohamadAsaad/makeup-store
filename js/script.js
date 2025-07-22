document.addEventListener("DOMContentLoaded", function () {

    // --- 1. FIREBASE CONFIGURATION & INITIALIZATION ---
    const firebaseConfig = {
        apiKey: "AIzaSyD4YYFUVMe3_R8Iz1aEA0VhVRvvI40kMFo",
        authDomain: "beautyecommercestore.firebaseapp.com",
        projectId: "beautyecommercestore",
        storageBucket: "beautyecommercestore.appspot.com",
        messagingSenderId: "919489491085",
        appId: "1:919489491085:web:ec0a8aa94b65354f4872c4"
    };

    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    // Safely initialize Firebase services to prevent errors on pages that might be missing a script
    const db = firebase.firestore();
    const auth = typeof firebase.auth === 'function' ? firebase.auth() : null;
    const storage = typeof firebase.storage === 'function' ? firebase.storage() : null;


    // --- 2. GLOBAL VARIABLES & UTILS ---
    const WHATSAPP_NUMBER = "+905516304088";
    let cart = JSON.parse(localStorage.getItem('makeupStoreCart')) || [];
    let allAdminProducts = [];
    let allAdminOrders = [];
    let allAdminCategories = [];

    // Pagination State
    let lastVisibleProduct = null;
    let firstVisibleProduct = null;
    let pageCursors = [null]; // لتخزين مؤشر بداية كل صفحة. null للصفحة الأولى
    let currentPage = 1;
    const PRODUCTS_PER_PAGE = 8;

    // --- 3. PAGE ROUTING & AUTHENTICATION ---
    const page = window.location.pathname.split("/").pop();

    // Only run auth-related logic if the auth service was successfully initialized
    if (auth) {
        auth.onAuthStateChanged(user => {
            if (user) {
                // User is signed in.
                if (page === 'login.html') {
                    window.location.href = 'dashboard.html';
                }
                if (page === 'dashboard.html') {
                    const logoutBtn = document.getElementById('logout-btn');
                    if (logoutBtn) {
                        logoutBtn.style.display = 'inline-block';
                        logoutBtn.addEventListener('click', handleLogout);
                    }
                    initializeDashboard();
                }
            } else {
                // User is signed out.
                if (page === 'dashboard.html') {
                    window.location.href = 'login.html';
                }
            }
        });
    }


    if (page === 'login.html') {
        const loginForm = document.getElementById('login-form');
        if (loginForm) loginForm.addEventListener('submit', handleLogin);
    }

    if (page === 'index.html' || page === '') {
        displayFeaturedProducts();
        displayHomepageCategorySections();
    } else if (page === 'shop.html') {
        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = urlParams.get('search');
        const categoryQuery = urlParams.get('category');
        populateShopCategoryFilters().then(() => {
            displayShopProducts({ category: categoryQuery || 'all', search: searchQuery });
        });
        if (searchQuery) {
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.value = searchQuery;
        }
    } else if (page === 'products.html') {
        displaySingleProduct();
    } else if (page === 'cart.html') {
        displayCartItems();
    } else if (page === 'checkout.html') {
        setupCheckoutForm();
    }

    const searchForm = document.getElementById('search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const searchInput = document.getElementById('search-input');
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `shop.html?search=${encodeURIComponent(query)}`;
            }
        });
    }

    // --- 4. AUTHENTICATION FUNCTIONS ---
    async function handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorAlert = document.getElementById('error-alert');

        if (!auth) {
            errorAlert.textContent = 'Auth service is not available.';
            errorAlert.style.display = 'block';
            return;
        }

        try {
            await auth.signInWithEmailAndPassword(email, password);
            // Redirect is handled by onAuthStateChanged listener
        } catch (error) {
            console.error("Login failed:", error);
            if (errorAlert) {
                errorAlert.textContent = 'فشل تسجيل الدخول. يرجى التحقق من البريد الإلكتروني وكلمة المرور.';
                errorAlert.style.display = 'block';
            }
        }
    }

    async function handleLogout() {
        try {
            if (auth) await auth.signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Logout failed:", error);
            alert('فشل تسجيل الخروج.');
        }
    }

    // --- 5. CART LOGIC ---
    function updateCartCount() {
        const count = cart.reduce((acc, item) => acc + item.quantity, 0);
        document.querySelectorAll('#cart-count, #cart-count-desktop').forEach(el => {
            if (el) el.innerText = count;
        });
    }

    function saveCart() {
        localStorage.setItem('makeupStoreCart', JSON.stringify(cart));
        updateCartCount();
    }

    window.addToCart = function (productId, name, price, imageUrl) {
        if (event) event.preventDefault();
        const existingProduct = cart.find(item => item.id === productId);
        if (existingProduct) {
            existingProduct.quantity++;
        } else {
            cart.push({ id: productId, name, price, imageUrl, quantity: 1 });
        }
        saveCart();
        const toastElement = document.getElementById('cart-toast');
        if (toastElement) {
            const toastBody = toastElement.querySelector('.toast-body');
            toastBody.textContent = `تمت إضافة "${name}" إلى السلة بنجاح!`;
            const toast = new bootstrap.Toast(toastElement);
            toast.show();
        }
    }

    // --- 6. DISPLAY FUNCTIONS (Storefront) ---

    async function displayHomepageCategorySections() {
        const container = document.getElementById('home-categories-container');
        if (!container) return;

        try {
            const snapshot = await db.collection('categories').orderBy('name').get();
            if (snapshot.empty) {
                container.innerHTML = `<p class="text-muted text-center">لم يتم إضافة تصنيفات بعد.</p>`;
                return;
            }

            let sectionsHTML = '';
            snapshot.forEach(doc => {
                const category = doc.data();
                const categoryId = doc.id;
                const productContainerId = `category-products-${categoryId}`;

                sectionsHTML += `
                <section class="text-center mb-5">
                    <h2 class="section-title">✨ ${category.name}</h2>
                    <div id="${productContainerId}" class="row g-4">
                        <div class="col-12 text-center my-5">
                            <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>
                        </div>
                    </div>
                    <div class="mt-4">
                        <a href="shop.html?category=${encodeURIComponent(category.name)}" class="btn btn-outline-primary">عرض كل منتجات ${category.name}</a>
                    </div>
                </section>
                <hr class="my-5">
                `;
            });

            container.innerHTML = sectionsHTML;

            snapshot.forEach(doc => {
                const category = doc.data();
                const categoryId = doc.id;
                const productContainerId = `category-products-${categoryId}`;
                displayProductsByCategory(category.name, productContainerId, 4);
            });

        } catch (error) {
            console.error("Error fetching categories for homepage: ", error);
            container.innerHTML = `<p class="text-danger text-center">عفواً، حدث خطأ في جلب التصنيفات.</p>`;
        }
    }

    async function populateShopCategoryFilters() {
        const container = document.getElementById('filter-buttons');
        if (!container) return;
        try {
            const snapshot = await db.collection('categories').orderBy('name').get();
            const urlParams = new URLSearchParams(window.location.search);
            const activeCategory = urlParams.get('category');

            snapshot.forEach(doc => {
                const category = doc.data();
                const button = document.createElement('button');
                button.className = 'btn btn-outline-primary';
                button.textContent = category.name;
                button.onclick = () => filterProducts(category.name, button);
                if (category.name === activeCategory) {
                    document.querySelector('#filter-buttons .btn.btn-primary').classList.replace('btn-primary', 'btn-outline-primary');
                    button.classList.replace('btn-outline-primary', 'btn-primary');
                }
                container.appendChild(button);
            });
        } catch (error) {
            console.error("Error fetching categories for filter buttons: ", error);
        }
    }

    async function displayProductsByCategory(category, containerId, limit = 8) {
        const container = document.getElementById(containerId);
        if (!container) return;
        try {
            const snapshot = await db.collection('products').where("category_ar", "==", category).limit(limit).get();
            if (snapshot.empty) {
                container.innerHTML = `<p class="text-muted col-12">لا توجد منتجات في هذا التصنيف حالياً.</p>`;
                return;
            }
            let productsHTML = '';
            snapshot.forEach(doc => {
                productsHTML += createProductCardHTML(doc.id, doc.data());
            });
            container.innerHTML = productsHTML;
        } catch (error) {
            console.error(`Error fetching ${category} products: `, error);
            container.innerHTML = `<p class="text-danger col-12">عفواً، حدث خطأ في جلب المنتجات.</p>`;
        }
    }

    async function displayFeaturedProducts() {
        const productsContainer = document.getElementById('featured-products');
        if (!productsContainer) return;
        try {
            const snapshot = await db.collection('products').where("is_featured", "==", true).limit(8).get();
            if (snapshot.empty) {
                productsContainer.innerHTML = `<p class="text-muted col-12">لا توجد منتجات مميزة حالياً.</p>`;
                return;
            }
            let productsHTML = '';
            snapshot.forEach(doc => {
                productsHTML += createProductCardHTML(doc.id, doc.data());
            });
            productsContainer.innerHTML = productsHTML;
        } catch (error) {
            console.error("Error fetching products: ", error);
            productsContainer.innerHTML = `<p class="text-danger col-12">عفواً، حدث خطأ في جلب المنتجات.</p>`;
        }
    }
    /**
     * يعرض المنتجات في صفحة "كل المنتجات" مع دعم للبحث والتصنيفات والتنقل بين الصفحات.
     * @param {object} options - خيارات العرض.
     * @param {string} [options.category='all'] - التصنيف المطلوب عرضه.
     * @param {string|null} [options.search=null] - مصطلح البحث.
     * @param {string|null} [options.direction=null] - اتجاه التنقل ('next' or 'prev').
     */
    async function displayShopProducts({ category = 'all', search = null, direction = null }) {
        const container = document.getElementById('all-products-container');
        const searchInfoContainer = document.getElementById('search-results-info');
        if (!container) return;

        // إظهار مؤشر التحميل
        container.innerHTML = `<div class="col-12 text-center my-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>`;
        if (searchInfoContainer) searchInfoContainer.innerHTML = '';

        try {
            // --- معالجة حالة البحث ---
            // ملاحظة هامة: هذا البحث يعمل من جانب العميل (client-side).
            // إنه غير فعال للمتاجر التي تحتوي على عدد كبير من المنتجات.
            // الحل الأمثل هو استخدام خدمة بحث متخصصة مثل Algolia أو Typesense.
            if (search) {
                const querySnapshot = await db.collection('products').get();
                const allProducts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const lowerCaseSearch = search.toLowerCase();
                const filteredProducts = allProducts.filter(p =>
                    p.name_ar.toLowerCase().includes(lowerCaseSearch) ||
                    (p.description_ar && p.description_ar.toLowerCase().includes(lowerCaseSearch))
                );

                if (filteredProducts.length === 0) {
                    container.innerHTML = `<p class="text-muted col-12">لا توجد منتجات تطابق بحثك.</p>`;
                } else {
                    container.innerHTML = filteredProducts.map(p => createProductCardHTML(p.id, p)).join('');
                }

                if (searchInfoContainer) searchInfoContainer.innerHTML = `<p>نتائج البحث عن: "<strong>${search}</strong>" (${filteredProducts.length})</p>`;
                document.getElementById('pagination-controls').innerHTML = ''; // إخفاء أزرار التنقل عند البحث
                return;
            }

            // --- معالجة حالة التصنيف والتنقل ---
            let query = db.collection('products').orderBy('createdAt', 'desc');

            if (category && category !== 'all') {
                query = query.where('category_ar', '==', category);
            }

            // تطبيق المؤشر الصحيح بناءً على اتجاه التنقل
            if (direction === 'next' && lastVisibleProduct) {
                query = query.startAfter(lastVisibleProduct);
            } else if (direction === 'prev') {
                // استخدام المؤشر المحفوظ للصفحة السابقة
                const prevPageCursor = pageCursors[currentPage - 1];
                query = query.startAfter(prevPageCursor);
            }

            const snapshot = await query.limit(PRODUCTS_PER_PAGE).get();

            if (snapshot.empty && currentPage === 1) {
                container.innerHTML = `<p class="text-muted col-12">لا توجد منتجات في هذا التصنيف.</p>`;
                renderPaginationControls(false); // لا توجد صفحة تالية
                return;
            }

            if (snapshot.empty && currentPage > 1) {
                // هذا يحدث إذا كانت الصفحة الأخيرة تحتوي بالضبط على PRODUCTS_PER_PAGE
                container.innerHTML = `<p class="text-muted col-12">وصلت إلى نهاية القائمة.</p>`;
                lastVisibleProduct = null;
                renderPaginationControls(false); // لا توجد صفحة تالية
                return;
            }

            // تحديث المؤشرات وتخزينها
            const firstVisible = snapshot.docs[0];
            lastVisibleProduct = snapshot.docs[snapshot.docs.length - 1];

            if (direction === 'next') {
                // إضافة مؤشر بداية الصفحة الجديدة إلى مصفوفة المؤشرات
                pageCursors.push(firstVisible);
            }

            // عرض المنتجات
            container.innerHTML = snapshot.docs.map(doc => createProductCardHTML(doc.id, doc.data())).join('');

            // التحقق من وجود صفحة تالية لعرض أو إخفاء زر "التالي"
            const nextQuery = query.startAfter(lastVisibleProduct).limit(1);
            const nextSnapshot = await nextQuery.get();
            renderPaginationControls(!nextSnapshot.empty);

        } catch (error) {
            console.error("Error fetching shop products: ", error);
            container.innerHTML = `<p class="text-danger col-12">عفواً، حدث خطأ في جلب المنتجات. قد يتطلب الأمر إنشاء فهرس في قاعدة البيانات.</p>`;
        }
    }

    function renderPaginationControls(hasNextPage) {
        const controlsContainer = document.getElementById('pagination-controls');
        if (!controlsContainer) return;

        let prevDisabled = (currentPage <= 1) ? 'disabled' : '';
        let nextDisabled = !hasNextPage ? 'disabled' : '';

        controlsContainer.innerHTML = `
            <button class="btn btn-outline-secondary" ${prevDisabled} onclick="navigatePage('prev')">السابق</button>
            <span class="btn disabled">صفحة ${currentPage}</span>
            <button class="btn btn-primary" ${nextDisabled} onclick="navigatePage('next')">التالي</button>
        `;
    }

    window.navigatePage = function (direction) {
        const urlParams = new URLSearchParams(window.location.search);
        const category = urlParams.get('category') || 'all';

        if (direction === 'next') {
            currentPage++;
            displayShopProducts({ category, direction: 'next' });
        } else if (direction === 'prev' && currentPage > 1) {
            currentPage--;
            // إزالة آخر مؤشر عند العودة للخلف
            pageCursors.pop();
            // تحديث آخر عنصر ظاهر ليكون العنصر الأخير من الصفحة السابقة (غير ضروري لأننا سنعيد بناءه)
            lastVisibleProduct = pageCursors[currentPage - 1];
            displayShopProducts({ category, direction: 'prev' });
        }
    }

    function createProductCardHTML(productId, product) {
        const mainImage = product.images && product.images.length > 0 ? product.images[0] : 'https://via.placeholder.com/250';
        return `
        <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
            <div class="card product-card h-100">
                <a href="products.html?id=${productId}" class="text-decoration-none">
                    <img src="${mainImage}" class="card-img-top" alt="${product.name_ar}">
                </a>
                <div class="card-body d-flex flex-column">
                    <h5 class="product-title">${product.name_ar}</h5>
                    <p class="product-price mt-2">${product.price} ر.س</p>
                    <button class="btn btn-primary mt-auto" onclick="addToCart('${productId}', '${product.name_ar}', ${product.price}, '${mainImage}')">أضف إلى السلة</button>
                </div>
            </div>
        </div>`;
    }

    async function displaySingleProduct() {
        const container = document.getElementById('product-details-container');
        if (!container) return;
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');
        if (!productId) {
            container.innerHTML = '<p class="text-danger text-center">عفواً، لم يتم العثور على المنتج.</p>';
            return;
        }
        try {
            const doc = await db.collection('products').doc(productId).get();
            if (!doc.exists) {
                container.innerHTML = '<p class="text-danger text-center">عفواً، هذا المنتج غير موجود.</p>';
                return;
            }
            const product = doc.data();
            const mainImage = product.images && product.images.length > 0 ? product.images[0] : 'https://via.placeholder.com/400';
            container.innerHTML = `
            <div class="row g-4">
                <div class="col-md-6"><img src="${mainImage}" class="img-fluid rounded shadow-sm w-100" alt="${product.name_ar}"></div>
                <div class="col-md-6 d-flex flex-column">
                    <h2>${product.name_ar}</h2>
                    <p class="text-muted">${product.category_ar}</p>
                    <h3 class="text-primary fw-bold my-3">${product.price} ر.س</h3>
                    <p class="flex-grow-1">${product.description_ar}</p>
                    <div class="d-grid gap-2 mt-auto">
                        <button class="btn btn-primary btn-lg" onclick="addToCart('${doc.id}', '${product.name_ar}', ${product.price}, '${mainImage}')">أضف إلى السلة</button>
                    </div>
                </div>
            </div>`;
        } catch (error) {
            console.error("Error fetching single product:", error);
            container.innerHTML = '<p class="text-danger text-center">حدث خطأ أثناء تحميل المنتج.</p>';
        }
    }

    function displayCartItems() {
        const itemsContainer = document.getElementById('cart-items');
        const totalElement = document.getElementById('cart-total');
        const checkoutButton = document.querySelector('a[href="checkout.html"]');
        if (!itemsContainer || !totalElement) return;

        if (cart.length === 0) {
            document.querySelector('.card.shadow-sm').innerHTML = '<div class="card-body text-center py-5"><h3>سلة الشراء فارغة!</h3><a href="index.html" class="btn btn-primary mt-3">العودة للتسوق</a></div>';
            return;
        }

        if (checkoutButton) checkoutButton.classList.remove('disabled');
        let total = 0;
        let itemsHTML = '';
        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            itemsHTML += `
                <tr>
                    <td><img src="${item.imageUrl}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;"></td>
                    <td class="fw-bold align-middle">${item.name}</td>
                    <td class="align-middle">${item.price.toFixed(2)} ر.س</td>
                    <td class="align-middle"><input type="number" class="form-control form-control-sm" value="${item.quantity}" min="1" onchange="updateQuantity('${item.id}', this.value)" style="width: 70px;"></td>
                    <td class="fw-bold align-middle">${itemTotal.toFixed(2)} ر.س</td>
                    <td class="align-middle"><button class="btn btn-sm btn-outline-danger" onclick="removeFromCart('${item.id}')">حذف</button></td>
                </tr>`;
        });
        itemsContainer.innerHTML = itemsHTML;
        totalElement.innerText = total.toFixed(2);
    }

    window.updateQuantity = function (productId, quantity) {
        const newQuantity = parseInt(quantity);
        const product = cart.find(item => item.id === productId);
        if (product && newQuantity > 0) {
            product.quantity = newQuantity;
            saveCart();
            displayCartItems();
        }
    };

    window.removeFromCart = function (productId) {
        cart = cart.filter(item => item.id !== productId);
        saveCart();
        displayCartItems();
    };

    window.filterProducts = function (category, element) {
        const url = new URL(window.location);
        if (category === 'all') {
            url.searchParams.delete('category');
        } else {
            url.searchParams.set('category', category);
        }
        url.searchParams.delete('search');
        window.history.pushState({}, '', url);

        document.querySelectorAll('#filter-buttons .btn').forEach(button => {
            button.classList.remove('btn-primary');
            button.classList.add('btn-outline-primary');
        });
        element.classList.remove('btn-outline-primary');
        element.classList.add('btn-primary');

        currentPage = 1;
        lastVisibleProduct = null;
        firstVisibleProduct = null;
        displayShopProducts({ category });
    };

    async function setupCheckoutForm() {
        const form = document.getElementById('checkout-form');
        if (!form) return;
        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            const submitButton = form.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> جاري الإرسال...';
            if (cart.length === 0) {
                alert('سلة الشراء فارغة!');
                submitButton.disabled = false;
                submitButton.textContent = 'تأكيد الطلب عبر واتساب';
                return;
            }
            const customerData = { name: document.getElementById('customerName').value, phone: document.getElementById('customerPhone').value, city: document.getElementById('customerCity').value, address: document.getElementById('customerAddress').value };
            const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
            try {
                const orderRef = await db.collection('orders').add({ customer: customerData, items: cart, total: total, status: 'new', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                let message = `*طلب جديد من متجر الجمال* ✨\n(رقم الطلب: ${orderRef.id})\n\n*المنتجات:*\n`;
                cart.forEach(item => { message += `- ${item.name} (الكمية: ${item.quantity})\n`; });
                message += `\n*الإجمالي: ${total.toFixed(2)} ر.س*\n\n*بيانات التوصيل:*\nالاسم: ${customerData.name}\nالهاتف: ${customerData.phone}\nالعنوان: ${customerData.city}, ${customerData.address}\n\nالدفع عند الاستلام.`;
                const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
                cart = [];
                saveCart();
                alert('تم إرسال طلبك بنجاح! سيتم تحويلك إلى واتساب الآن.');
                window.open(whatsappUrl, '_blank');
                window.location.href = 'index.html';
            } catch (error) {
                console.error("Error placing order: ", error);
                alert('حدث خطأ أثناء إرسال الطلب. الرجاء المحاولة مرة أخرى.');
                submitButton.disabled = false;
                submitButton.textContent = 'تأكيد الطلب عبر واتساب';
            }
        });
    }

    // --- 7. DASHBOARD FUNCTIONS (SECURED & ENHANCED) ---
    function initializeDashboard() {
        if (!document.body.classList.contains('dashboard-body') || !storage) return;

        const productFormContainer = document.getElementById('add-product-form-container');
        const productForm = document.getElementById('product-form');
        const showProductFormBtn = document.getElementById('show-add-product-form-btn');
        const cancelEditBtn = document.getElementById('cancel-edit-btn');
        const formTitle = document.getElementById('form-title');

        if (showProductFormBtn) {
            showProductFormBtn.addEventListener('click', () => {
                formTitle.textContent = 'إضافة منتج جديد';
                productForm.reset();
                document.getElementById('productId').value = '';
                document.getElementById('current-images-display').innerHTML = '';
                productFormContainer.style.display = 'block';
            });
        }
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => { productFormContainer.style.display = 'none'; });
        }
        if (productForm) {
            productForm.addEventListener('submit', handleProductFormSubmit);
        }
        const categoryForm = document.getElementById('category-form');
        const cancelCategoryEditBtn = document.getElementById('cancel-category-edit-btn');
        if (categoryForm) {
            categoryForm.addEventListener('submit', handleCategoryFormSubmit);
        }
        if (cancelCategoryEditBtn) {
            cancelCategoryEditBtn.addEventListener('click', () => {
                document.getElementById('category-form').reset();
                document.getElementById('categoryId').value = '';
                document.getElementById('category-form-title').textContent = 'إضافة تصنيف جديد';
                cancelCategoryEditBtn.style.display = 'none';
            });
        }
        document.getElementById('product-search-input')?.addEventListener('input', (e) => renderAdminProducts(e.target.value));
        document.getElementById('order-search-input')?.addEventListener('input', (e) => renderAdminOrders(document.querySelector('#order-filter-buttons .btn-primary').dataset.status, e.target.value));
        loadDashboardData();
    }

    async function loadDashboardData() {
        try {
            const [productsSnapshot, ordersSnapshot, categoriesSnapshot] = await Promise.all([
                db.collection('products').orderBy('createdAt', 'desc').get(),
                db.collection('orders').orderBy('createdAt', 'desc').get(),
                db.collection('categories').orderBy('name').get()
            ]);
            allAdminProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            allAdminOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            allAdminCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderDashboardOverview();
            renderAdminProducts();
            renderAdminOrders();
            renderAdminCategories();
            populateCategoryDropdown();
        } catch (error) {
            console.error("Error loading dashboard data:", error);
            showNotification('فشل تحميل بيانات لوحة التحكم.', 'danger');
        }
    }

    function renderDashboardOverview() {
        const statsContainer = document.getElementById('dashboard-stats');
        const recentOrdersContainer = document.getElementById('recent-orders-container');
        if (!statsContainer || !recentOrdersContainer) return;
        const totalRevenue = allAdminOrders.reduce((sum, order) => sum + order.total, 0);
        const totalOrders = allAdminOrders.length;
        const productCount = allAdminProducts.length;
        const statusCounts = allAdminOrders.reduce((counts, order) => {
            counts[order.status] = (counts[order.status] || 0) + 1;
            return counts;
        }, {});
        statsContainer.innerHTML = `
            <div class="col-md-3 col-6 mb-4"><div class="card p-3 text-center shadow-sm h-100"><h6 class="text-muted">إجمالي الإيرادات</h6><h4 class="fw-bold">${totalRevenue.toFixed(2)} ر.س</h4></div></div>
            <div class="col-md-3 col-6 mb-4"><div class="card p-3 text-center shadow-sm h-100"><h6 class="text-muted">إجمالي الطلبات</h6><h4 class="fw-bold">${totalOrders}</h4></div></div>
            <div class="col-md-3 col-6 mb-4"><div class="card p-3 text-center shadow-sm h-100"><h6 class="text-muted">المنتجات</h6><h4 class="fw-bold">${productCount}</h4></div></div>
            <div class="col-md-3 col-6 mb-4"><div class="card p-3 text-center shadow-sm h-100"><h6 class="text-muted">طلبات جديدة</h6><h4 class="fw-bold text-primary">${statusCounts['new'] || 0}</h4></div></div>
        `;
        const recentOrders = allAdminOrders.slice(0, 5);
        recentOrdersContainer.innerHTML = createOrdersHTML(recentOrders);
    }

    function renderAdminProducts(searchTerm = '') {
        const tableBody = document.getElementById('products-table-body');
        if (!tableBody) return;
        const filteredProducts = allAdminProducts.filter(p => p.name_ar.toLowerCase().includes(searchTerm.toLowerCase()));
        if (filteredProducts.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">لا توجد منتجات.</td></tr>';
            return;
        }
        tableBody.innerHTML = filteredProducts.map(product => `
            <tr>
                <td>${product.name_ar}</td>
                <td>${product.price} ر.س</td>
                <td>${product.stock}</td>
                <td>${product.category_ar}</td>
                <td>${product.is_featured ? '✔️' : '❌'}</td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-outline-secondary" onclick="editProduct('${product.id}')"><i class="bi bi-pencil"></i> تعديل</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct('${product.id}')"><i class="bi bi-trash"></i> حذف</button>
                </td>
            </tr>
        `).join('');
    }

    window.filterOrdersByStatus = function (status) {
        document.querySelectorAll('#order-filter-buttons .btn').forEach(button => {
            button.classList.remove('btn-primary');
            button.classList.add('btn-outline-secondary');
        });
        event.target.classList.add('btn-primary');
        event.target.classList.remove('btn-outline-secondary');
        const searchTerm = document.getElementById('order-search-input').value;
        renderAdminOrders(status, searchTerm);
    }

    function renderAdminOrders(status = 'all', searchTerm = '') {
        const container = document.getElementById('orders-container');
        if (!container) return;
        let filteredOrders = allAdminOrders;
        if (status !== 'all') {
            filteredOrders = filteredOrders.filter(order => order.status === status);
        }
        if (searchTerm) {
            const lowerCaseSearch = searchTerm.toLowerCase();
            filteredOrders = filteredOrders.filter(order =>
                order.customer.name.toLowerCase().includes(lowerCaseSearch) ||
                order.customer.phone.includes(lowerCaseSearch)
            );
        }
        if (filteredOrders.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">لا توجد طلبات تطابق الفلتر الحالي.</p>';
            return;
        }
        container.innerHTML = createOrdersHTML(filteredOrders);
    }

    function getStatusBadge(status) {
        const statusMap = {
            'new': { text: 'جديد', class: 'status-new' },
            'processing': { text: 'قيد التجهيز', class: 'status-processing' },
            'shipped': { text: 'تم الشحن', class: 'status-shipped' },
            'cancelled': { text: 'ملغي', class: 'status-cancelled' }
        };
        const statusInfo = statusMap[status] || { text: status, class: 'bg-secondary' };
        return `<span class="badge ${statusInfo.class}">${statusInfo.text}</span>`;
    }

    function createOrdersHTML(orders) {
        return orders.map(order => {
            const orderDate = order.createdAt ? order.createdAt.toDate().toLocaleString('ar-EG') : 'N/A';
            let itemsList = order.items.map(item => `<li>${item.name} (الكمية: ${item.quantity})</li>`).join('');
            return `
                <div class="card mb-3 border-light shadow-sm order-card">
                    <div class="card-header bg-light d-flex justify-content-between align-items-center flex-wrap">
                        <div><strong>طلب من: ${order.customer.name}</strong><small class="text-muted d-block">${order.customer.phone}</small></div>
                        ${getStatusBadge(order.status)}
                    </div>
                    <div class="card-body">
                        <p><strong>العنوان:</strong> ${order.customer.city}, ${order.customer.address}</p><hr>
                        <h6>المنتجات (الإجمالي: <span class="text-primary fw-bold">${order.total.toFixed(2)} ر.س</span>)</h6>
                        <ul>${itemsList}</ul>
                    </div>
                    <div class="card-footer bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
                         <div class="d-flex align-items-center gap-2">
                            <label for="status-${order.id}" class="form-label me-2 mb-0">الحالة:</label>
                            <select class="form-select form-select-sm" style="width: 150px;" id="status-${order.id}" onchange="updateOrderStatus('${order.id}', this.value)">
                                <option value="new" ${order.status === 'new' ? 'selected' : ''}>جديد</option>
                                <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>قيد التجهيز</option>
                                <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>تم الشحن</option>
                                <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>ملغي</option>
                            </select>
                            
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteOrder('${order.id}')">
                                <i class="bi bi-trash"></i> حذف
                            </button>
                        </div>
                        <small class="text-muted text-start">رقم الطلب: ${order.id}<br>${orderDate}</small>
                    </div>
                </div>`;
        }).join('');
    }

async function handleProductFormSubmit(e) {
    e.preventDefault();
    const saveButton = document.getElementById('save-product-btn');
    saveButton.disabled = true;
    saveButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> جاري الحفظ...';

    const productId = document.getElementById('productId').value;
    const imageFiles = document.getElementById('productImageFiles').files;

    // دالة لتحويل ملف إلى نص Base64
    const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    try {
        let newImageUrls = [];
        if (imageFiles.length > 0) {
            // تحويل كل الصور الجديدة التي تم اختيارها
            newImageUrls = await Promise.all(Array.from(imageFiles).map(toBase64));
        }
        
        // جلب الصور القديمة إذا كان المنتج قيد التعديل
        let existingImageUrls = [];
        if (productId) {
            const product = allAdminProducts.find(p => p.id === productId);
            if (product && product.images) {
                existingImageUrls = product.images;
            }
        }
        
        const allImageUrls = [...existingImageUrls, ...newImageUrls];

        const productData = {
            name_ar: document.getElementById('productName').value,
            price: parseFloat(document.getElementById('productPrice').value),
            description_ar: document.getElementById('productDescription').value,
            category_ar: document.getElementById('productCategory').value,
            stock: parseInt(document.getElementById('productStock').value),
            is_featured: document.getElementById('isFeatured').checked,
            images: allImageUrls // هنا سيتم حفظ نصوص Base64
        };

        if (productId) {
            // تحديث المنتج الحالي
            await db.collection('products').doc(productId).update(productData);
            showNotification('تم تحديث المنتج بنجاح!', 'success');
        } else {
            // إضافة منتج جديد
            productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('products').add(productData);
            showNotification('تم إضافة المنتج بنجاح!', 'success');
        }

        document.getElementById('add-product-form-container').style.display = 'none';
        document.getElementById('product-form').reset();
        await loadDashboardData(); // إعادة تحميل البيانات

    } catch (error) {
        console.error("Error saving product with Base64:", error);
        showNotification('حدث خطأ أثناء حفظ المنتج. تحقق من حجم الصور.', 'danger');
    } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = 'حفظ المنتج';
    }
}


    window.editProduct = (productId) => {
        const product = allAdminProducts.find(p => p.id === productId);
        if (!product) {
            showNotification('المنتج غير موجود!', 'danger');
            return;
        }
        const productFormContainer = document.getElementById('add-product-form-container');
        document.getElementById('form-title').textContent = 'تعديل المنتج';
        document.getElementById('productId').value = productId;
        document.getElementById('productName').value = product.name_ar;
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productDescription').value = product.description_ar;
        document.getElementById('productCategory').value = product.category_ar;
        document.getElementById('productStock').value = product.stock;

        const imagesDisplay = document.getElementById('current-images-display');
        imagesDisplay.innerHTML = '';
        if (product.images && product.images.length > 0) {
            product.images.forEach(url => {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'position-relative';
                imgContainer.innerHTML = `<img src="${url}" width="70" height="70" class="rounded border">`;
                imagesDisplay.appendChild(imgContainer);
            });
        } else {
            imagesDisplay.innerHTML = '<p class="text-muted small">لا توجد صور حالية.</p>';
        }

        document.getElementById('productImageFiles').value = '';
        document.getElementById('isFeatured').checked = product.is_featured;
        productFormContainer.style.display = 'block';
        window.scrollTo(0, 0);
    };

    window.deleteProduct = async (productId) => {
        if (confirm('هل أنت متأكد من رغبتك في حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.')) {
            try {
                const productRef = db.collection('products').doc(productId);
                const productDoc = await productRef.get();

                if (productDoc.exists) {
                    const productData = productDoc.data();
                    // التحقق من وجود صور لحذفها
                    if (productData.images && productData.images.length > 0) {
                        const deletePromises = productData.images.map(imageUrl => {
                            // استخلاص مسار الصورة من الرابط
                            const imageRef = storage.refFromURL(imageUrl);
                            return imageRef.delete();
                        });
                        // انتظار حذف جميع الصور
                        await Promise.all(deletePromises);
                    }
                }

                // حذف بيانات المنتج من Firestore
                await productRef.delete();
                showNotification('تم حذف المنتج وجميع صوره بنجاح.', 'success');
                loadDashboardData();

            } catch (error) {
                console.error("Error deleting product and its images:", error);
                showNotification('حدث خطأ أثناء حذف المنتج.', 'danger');
            }
        }
    };

    window.updateOrderStatus = async (orderId, newStatus) => {
        try {
            await db.collection('orders').doc(orderId).update({ status: newStatus });
            const order = allAdminOrders.find(o => o.id === orderId);
            if (order) order.status = newStatus;
            showNotification(`تم تحديث حالة الطلب.`, 'success');
            // Optimistically update the UI without a full reload for better performance
            const badge = document.querySelector(`.order-card select[id='status-${orderId}']`).closest('.card-header').querySelector('.badge');
            const statusInfo = getStatusBadge(newStatus);
            badge.className = `badge ${statusInfo.class}`;
            badge.textContent = statusInfo.text;
        } catch (error) {
            console.error("Error updating order status:", error);
            showNotification('حدث خطأ أثناء تحديث حالة الطلب.', 'danger');
        }
    };

    /**
 * يقوم بحذف طلب محدد من قاعدة البيانات بعد تأكيد المستخدم.
 * @param {string} orderId - معرف الطلب المراد حذفه.
 */
    window.deleteOrder = async (orderId) => {
        if (confirm('هل أنت متأكد من رغبتك في حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.')) {
            try {
                await db.collection('orders').doc(orderId).delete();
                showNotification('تم حذف الطلب بنجاح.', 'success');
                // إعادة تحميل بيانات لوحة التحكم لتحديث القائمة
                loadDashboardData();
            } catch (error) {
                console.error("Error deleting order:", error);
                showNotification('حدث خطأ أثناء حذف الطلب.', 'danger');
            }
        }
    };

    function renderAdminCategories() {
        const tableBody = document.getElementById('categories-table-body');
        if (!tableBody) return;
        if (allAdminCategories.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="2" class="text-center">لا توجد تصنيفات.</td></tr>';
            return;
        }
        tableBody.innerHTML = allAdminCategories.map(cat => `
            <tr>
                <td>${cat.name}</td>
                <td class="actions-cell">
                    <button class="btn btn-sm btn-outline-secondary" onclick="editCategory('${cat.id}', '${cat.name}')"><i class="bi bi-pencil"></i> تعديل</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory('${cat.id}')"><i class="bi bi-trash"></i> حذف</button>
                </td>
            </tr>
        `).join('');
    }

    async function handleCategoryFormSubmit(e) {
        e.preventDefault();
        const categoryId = document.getElementById('categoryId').value;
        const categoryName = document.getElementById('categoryName').value.trim();
        if (!categoryName) return;
        try {
            if (categoryId) {
                await db.collection('categories').doc(categoryId).update({ name: categoryName });
                showNotification('تم تحديث التصنيف بنجاح!', 'success');
            } else {
                await db.collection('categories').add({ name: categoryName });
                showNotification('تم إضافة التصنيف بنجاح!', 'success');
            }
            document.getElementById('category-form').reset();
            document.getElementById('categoryId').value = '';
            document.getElementById('category-form-title').textContent = 'إضافة تصنيف جديد';
            document.getElementById('cancel-category-edit-btn').style.display = 'none';
            loadDashboardData();
        } catch (error) {
            console.error("Error saving category:", error);
            showNotification('حدث خطأ أثناء حفظ التصنيف.', 'danger');
        }
    }
    window.editCategory = (id, name) => {
        document.getElementById('category-form-title').textContent = 'تعديل التصنيف';
        document.getElementById('categoryId').value = id;
        document.getElementById('categoryName').value = name;
        document.getElementById('cancel-category-edit-btn').style.display = 'inline-block';
    };
    window.deleteCategory = async (id) => {
        if (confirm('هل أنت متأكد من رغبتك في حذف هذا التصنيف؟')) {
            try {
                await db.collection('categories').doc(id).delete();
                showNotification('تم حذف التصنيف بنجاح.', 'success');
                loadDashboardData();
            } catch (error) {
                console.error("Error deleting category:", error);
                showNotification('حدث خطأ أثناء حذف التصنيف.', 'danger');
            }
        }
    };
    function populateCategoryDropdown() {
        const selectElement = document.getElementById('productCategory');
        if (!selectElement) return;
        const currentVal = selectElement.value;
        selectElement.innerHTML = '<option value="">-- اختر تصنيف --</option>';
        allAdminCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            if (cat.name === currentVal) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    }

    function showNotification(message, type = 'success') {
        const notificationArea = document.getElementById('notification-area');
        if (!notificationArea) return;
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show shadow-lg`;
        alert.role = 'alert';
        alert.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;
        notificationArea.append(alert);
        setTimeout(() => {
            const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
            if (bsAlert) {
                bsAlert.close();
            }
        }, 5000);
    }

    // --- INITIALIZATION ---
    updateCartCount();
});
