import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    increment,
    serverTimestamp,
    setDoc,
    updateDoc
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    SafeAreaView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { WebView } from 'react-native-webview';
import { auth, db } from '../firebaseConfig';

const { width, height } = Dimensions.get('window');

export default function PaymentScreen() {
    const router = useRouter();
    
    // --- ROUTE PARAMS ---
    const { 
        amount, 
        email, 
        eventDate, 
        cartItems, 
        deliveryFee, 
        address, 
        lat, 
        lon,
        orderStatus,
        orderType 
    } = useLocalSearchParams<{ 
        amount: string, 
        email: string, 
        eventDate: string,
        cartItems: string,
        deliveryFee: string,
        address: string,
        lat: string,    
        lon: string,
        orderStatus?: string,
        orderType?: string
    }>();
    
    const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const backendUrl = "https://574d-105-244-79-83.ngrok-free.app/api/paystack/generate-payment-url";

    useEffect(() => {
        if (amount && email) {
            generatePaymentUrl(email, parseInt(amount));
        } else {
            Alert.alert("Error", "Missing payment information");
            router.back();
        }
    }, [amount, email]);

    const generatePaymentUrl = async (userEmail: string, orderAmount: number) => {
        try {
            setLoading(true);
            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true' 
                },
                body: JSON.stringify({
                    email: userEmail,
                    amount: orderAmount * 100, 
                }),
            });

            const data = await response.json();
            if (data.url) {
                setPaymentUrl(data.url);
            } else {
                throw new Error("No URL returned");
            }
        } catch (error) {
            Alert.alert("Payment Error", "Could not initialize payment gateway.");
        } finally {
            setLoading(false);
        }
    };

    const handleNavigationStateChange = (navState: any) => {
        const { url } = navState;
        const isSuccessful = url.includes("success") || 
                             url.includes("trxref") || 
                             url.includes("reference=") ||
                             url.includes("payment-complete");

        if (isSuccessful && !isProcessing) {
            setIsProcessing(true);
            setLoading(true); 
            saveCartToOrders();
        }
    };

    const saveCartToOrders = async () => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        try {
            const userSnap = await getDoc(doc(db, "users", userId));
            const realName = userSnap.exists() ? (userSnap.data().fullName || userSnap.data().name) : "Customer";

            const rawItems = cartItems ? JSON.parse(cartItems) : [];
            if (rawItems.length === 0) return;

            const heroItem = rawItems[0];
            const isCustomQuote = heroItem.isCustom === true && 
                                 (heroItem.status === 'price_set' || heroItem.status === 'accepted_in_cart');

            if (isCustomQuote) {
                const customDocRef = doc(db, "customer_orders", heroItem.productId);
                
                // Fallback expected delivery for custom orders (e.g. 7 days from payment start)
                const fallbackCustomDate = new Date();
                fallbackCustomDate.setDate(fallbackCustomDate.getDate() + (heroItem.productionDays || 7));

                await updateDoc(customDocRef, {
                    adminApproved: true,
                    status: "Paid",
                    orderStatus: orderStatus || "active",
                    
                    // --- TIMESTAMPS ---
                    paidAt: serverTimestamp(),
                    createdAt: serverTimestamp(),     // Sync with standard orders
                    timestamp: serverTimestamp(),     // Sync with standard orders
                    startDate: serverTimestamp(),     // Explicit start date of production
                    
                    // --- EXPECTED COMPLETION/EVENT DATE ---
                    eventDate: eventDate || heroItem.eventDate || fallbackCustomDate.toISOString(),
                    
                    fullName: realName,
                    totalAmount: parseInt(amount || "0"),
                    deliveryAddress: address || "Not Provided",
                    latitude: lat || null,                      
                    longitude: lon || null,                     
                    paymentRef: "PAYSTACK_" + Date.now()
                });
            } else {
                // Fallback expected delivery for standard orders (e.g. 3 days from payment)
                const fallbackStandardDate = new Date();
                fallbackStandardDate.setDate(fallbackStandardDate.getDate() + 3);

                const orderData = {
                    userId: userId,
                    customerId: userId,
                    email: auth.currentUser?.email,
                    fullName: realName,
                    totalAmount: parseInt(amount || "0"),
                    deliveryFee: parseInt(deliveryFee || "0"),
                    deliveryAddress: address || "STUDIO COLLECTION", 
                    latitude: lat || "0",
                    longitude: lon || "0",
                    
                    status: "Paid",
                    orderStatus: orderStatus || "active",
                    orderType: orderType || "STANDARD",
                    
                    // --- TIMESTAMPS ---
                    paidAt: serverTimestamp(),
                    createdAt: serverTimestamp(),
                    timestamp: serverTimestamp(),
                    startDate: serverTimestamp(),     // Explicit start date of fulfillment
                    
                    // --- EXPECTED COMPLETION/EVENT DATE ---
                    eventDate: eventDate || heroItem.eventDate || fallbackStandardDate.toISOString(),

                    // SANITIZED HERO IMAGE URL (%2F)
                    imageUrl: sanitizeFirebaseUrl(heroItem.imageUrl || ""), 
                    
                    // SANITIZED IMAGES ARRAY (%2F)
                    images: rawItems
                        .map((i: any) => i.images ? i.images : [i.imageUrl])
                        .flat()
                        .filter(Boolean)
                        .map((url: string) => sanitizeFirebaseUrl(url)), 
                    
                    // SANITIZED ITEM-LEVEL IMAGES (%2F)
                    items: rawItems.map(({ status: itemStatus, ...item }: any) => ({
                        ...item,
                        productId: item.productId?.split('_')[0],
                        imageUrl: sanitizeFirebaseUrl(item.imageUrl || ""),
                        image: sanitizeFirebaseUrl(item.image || "")
                    })),
                    itemCount: rawItems.length,
                    isCustom: false
                };

                await addDoc(collection(db, "orders"), orderData);
                await updatePopularProducts(orderData.items);
            }

            // Clear Cart
            const cartRef = collection(db, "users", userId, "cart");
            const snapshot = await getDocs(cartRef);
            const deletePromises = snapshot.docs.map(docSnap => 
                deleteDoc(doc(db, "users", userId, "cart", docSnap.id))
            );
            await Promise.all(deletePromises);

            Alert.alert("Success", "Payment confirmed!");
            router.replace('/(tabs)');
        } catch (error) {
            console.error("Critical Save Error:", error);
            Alert.alert("Error", "Payment successful, but record failed. Contact support.");
        }
    };

    const sanitizeFirebaseUrl = (url: string): string => {
        if (!url) return "";

        const match = url.match(/\/o\/([^?]+)/);
        if (!match) return url;

        try {
            return url.replace(match[1], encodeURIComponent(decodeURIComponent(match[1])));
        } catch {
            return url;
        }
    };

    const updatePopularProducts = async (items: any[]) => {
        for (const item of items) {
            if (!item.productId) continue;
            
            const cleanProductId = item.productId.split('_')[0];
            const popularDocRef = doc(db, "popular", cleanProductId);

            try {
                const popularSnap = await getDoc(popularDocRef);

                if (popularSnap.exists()) {
                    await updateDoc(popularDocRef, { 
                        orderCount: increment(item.quantity || 1) 
                    });
                } else {
                    const productDocRef = doc(db, "products", cleanProductId);
                    const productSnap = await getDoc(productDocRef);

                    let rawUrl = item.imageUrl || "";

                    if (productSnap.exists()) {
                        const productData = productSnap.data();
                        rawUrl = productData.imageUrl || (productData.images && productData.images[0]) || rawUrl;
                    }

                    await setDoc(popularDocRef, {
                        name: item.name,
                        price: item.price,
                        imageUrl: sanitizeFirebaseUrl(rawUrl),
                        productId: cleanProductId,
                        orderCount: item.quantity || 1
                    });
                }
            } catch (e) { 
                console.log("Stats update failed", e); 
            }
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#FFD700" />
                    <Text style={styles.loadingText}>
                        {isProcessing ? "Processing Order..." : "Connecting to Payment Gateway..."}
                    </Text>
                </View>
            ) : paymentUrl ? (
                <WebView
                    source={{ uri: paymentUrl }}
                    onNavigationStateChange={handleNavigationStateChange}
                    startInLoadingState={true}
                    renderLoading={() => (
                        <View style={styles.webViewLoader}>
                            <ActivityIndicator size="large" color="#FFD700" />
                        </View>
                    )}
                />
            ) : (
                <View style={styles.centered}>
                    <Text style={{ color: '#fff' }}>Failed to load gateway.</Text>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
    loadingText: { color: '#FFD700', marginTop: 15, fontWeight: 'bold' },
    webViewLoader: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000'
    }
});