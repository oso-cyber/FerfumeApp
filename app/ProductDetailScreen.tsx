import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { auth, db } from '../firebaseConfig';

const { width, height } = Dimensions.get('window');

export default function ProductDetailScreen() {
    const { productId } = useLocalSearchParams<{ productId: string }>();
    const router = useRouter();
    
    const [product, setProduct] = useState<any>(null);
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(true);
    const [activeSlide, setActiveSlide] = useState(0);

    const [isArchitectVisible, setIsArchitectVisible] = useState(false);
    const [isCustomized, setIsCustomized] = useState(false);
    const [customNotes, setCustomNotes] = useState('');
    
    // DELIVERY STATES
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [isLocating, setIsLocating] = useState(false);
    
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 7);
    const [eventDate, setEventDate] = useState(minDate);
    const [showDatePicker, setShowDatePicker] = useState(false);

    useEffect(() => {
        if (productId) fetchProductDetails();
    }, [productId]);

    const fetchProductDetails = async () => {
        setLoading(true);
        try {
            let docRef = doc(db, "products", productId as string);
            let docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
                docRef = doc(db, "packages_deals", productId as string);
                docSnap = await getDoc(docRef);
            }
            if (docSnap.exists()) {
                setProduct({ id: docSnap.id, ...docSnap.data() });
            } else {
                Alert.alert("Error", "Product not found");
                router.back();
            }
        } catch (error) {
            Alert.alert("Error", "Failed to load details.");
        } finally {
            setLoading(false);
        }
    };

    // --- AUTO LOCATION LOGIC ---
    const getCurrentLocation = async () => {
        setIsLocating(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission Denied", "Allow location access to use this feature.");
                return;
            }
            let location = await Location.getCurrentPositionAsync({});
            let address = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            });
            
            if (address.length > 0) {
                const item = address[0];
                const formatted = `${item.name || ''} ${item.street || ''}, ${item.city || ''}`;
                setDeliveryAddress(formatted);
            }
        } catch (error) {
            Alert.alert("Error", "Could not fetch location.");
        } finally {
            setIsLocating(false);
        }
    };

    const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const slideSize = event.nativeEvent.layoutMeasurement.width;
        const index = event.nativeEvent.contentOffset.x / slideSize;
        setActiveSlide(Math.round(index));
    };

    const handleFinalSubmit = async () => {
        const user = auth.currentUser;
        if (!user) {
            Alert.alert("Login Required", "Please log in to place an order.");
            return;
        }

        try {
            const userDocSnap = await getDoc(doc(db, "users", user.uid));
            const userData = userDocSnap.exists() ? userDocSnap.data() : null;
            const fullName = userData?.fullName || "Unnamed Customer";

            const orderId = `${product.id}_${Date.now()}`;
            
            const isPack = product.isPackage ?? (product.bundleItems && product.bundleItems.length > 0) ?? false;
            const bundleContents = product.bundleItems ?? [];

            const orderPayload = {
                orderId: orderId, 
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity: quantity,
                imageUrl: product.imageUrl || "",
                isPackage: isPack, 
                bundleItems: bundleContents, 
                isCustomized: isCustomized,
                customNotes: isCustomized ? (customNotes || "Standard customization") : "",
                deliveryAddress: deliveryAddress || "Collection",
                needsDelivery: deliveryAddress.length > 0,
                eventDate: isCustomized ? eventDate.toISOString() : new Date().toISOString(),
                customerId: user.uid,
                customerEmail: user.email || "",
                fullName: fullName, 
                status: isCustomized ? "awaiting_admin" : "active",
                timestamp: serverTimestamp(), 
            };

            if (isCustomized) {
                await setDoc(doc(doc(db, "customer_orders"), orderId), {
                    ...orderPayload,
                    adminApproved: false,
                    needs_review: true,
                    adminSeen: false,
                    reviewStatus: "pending"
                });
                Alert.alert("Design Sent", "Sent for Admin review. Final price (including delivery) will be updated shortly.");
                router.push('/(tabs)');
            } else {
                await setDoc(doc(db, "users", user.uid, "cart", orderId), orderPayload);
                Alert.alert("Success", "Added to cart.", [
                    { text: "View Cart", onPress: () => router.push('/cart') }, 
                    { text: "Continue" }
                ]);
            }
        } catch (error) {
            console.error("Submission Error:", error);
            Alert.alert("Error", "Could not process your request.");
        }
    };

    if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color="#FFD700" /></View>;
    if (!product) return null;

    const isWeddingCake = product.name?.toLowerCase().includes('wedding');
    const isPackage = product.bundleItems && product.bundleItems.length > 0;
    
    // Items list for the carousel
    const imageList = isPackage 
        ? product.bundleItems 
        : [{ imageUrl: product.imageUrl, name: product.name, description: product.description }];

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* CAROUSEL SECTION */}
                <View style={styles.imageContainer}>
                    <FlatList
                        data={imageList}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={onScroll}
                        keyExtractor={(_: any, index: number) => index.toString()}
                        renderItem={({ item, index }) => (
                            <View style={styles.slide}>
                                <Image source={{ uri: item.imageUrl }} style={styles.mainImage} contentFit="cover" />
                                
                                {/* Overlay Card for Bundle Items */}
                                {isPackage && (
                                    <View style={styles.slideOverlay}>
                                        <View style={styles.badge}>
                                            <Text style={styles.badgeText}>Item {index + 1} of {imageList.length}</Text>
                                        </View>
                                        {item.name && <Text style={styles.slideTitle}>{item.name}</Text>}
                                        {item.description && <Text style={styles.slideSub}>{item.description}</Text>}
                                    </View>
                                )}
                            </View>
                        )}
                    />

                    <TouchableOpacity
                        style={styles.floatingBackBtn}
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <Ionicons name="arrow-back" size={22} color="#fff" />
                    </TouchableOpacity>

                    <View style={styles.heroHeading} pointerEvents="none">
                        <Text style={styles.heroBrand}>{product.brand || 'LUXURY SELECTION'}</Text>
                        <Text style={styles.heroName} numberOfLines={2}>{product.name}</Text>
                    </View>
                    
                    {/* Pagination Indicators */}
                    {imageList.length > 1 && (
                        <View style={styles.paginationContainer}>
                            {imageList.map((_: any, idx: number) => (
                                <View 
                                    key={idx.toString()} 
                                    style={[styles.dot, activeSlide === idx && styles.activeDot]} 
                                />
                            ))}
                        </View>
                    )}
                </View>

                <View style={styles.content}>
                    <View style={styles.priceRow}>
                        <Text style={styles.price}>R {(product.price * quantity).toLocaleString()}</Text>
                        {deliveryAddress.length > 0 && isWeddingCake && (
                            <Text style={styles.deliveryStatus}>+ Delivery (Pending Admin)</Text>
                        )}
                    </View>

                    <TouchableOpacity 
                        style={[styles.customizeCard, isCustomized && styles.activeCustomCard]} 
                        onPress={() => setIsArchitectVisible(true)}
                    >
                        <View style={styles.customizeLeft}>
                            <View style={[styles.iconCircle, isCustomized && {backgroundColor: '#FFD700'}]}>
                                <Ionicons name={isCustomized ? "checkmark" : "color-wand"} size={22} color={isCustomized ? "#000" : "#FFD700"} />
                            </View>
                            <View>
                                <Text style={styles.customizeTitle}>The Architect</Text>
                                <Text style={styles.customizeSub}>Design & Delivery Location</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#FFD700" />
                    </TouchableOpacity>

                    {/* BUNDLE ITEMS SUMMARY LIST (If Package) */}
                    {isPackage && (
                        <>
                            <View style={styles.divider} />
                            <Text style={styles.sectionTitle}>PACKAGE INCLUSIONS ({product.bundleItems.length} ITEMS)</Text>
                            <View style={styles.bundleList}>
                                {product.bundleItems.map((item: any, idx: number) => (
                                    <View key={idx.toString()} style={styles.bundleCard}>
                                        <Image source={{ uri: item.imageUrl }} style={styles.bundleThumb} contentFit="cover" />
                                        <View style={styles.bundleInfo}>
                                            <Text style={styles.bundleItemName}>{item.name || `Included Item ${idx + 1}`}</Text>
                                            {item.description && (
                                                <Text style={styles.bundleItemDesc} numberOfLines={2}>
                                                    {item.description}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </>
                    )}

                    <View style={styles.divider} />
                    <Text style={styles.sectionTitle}>Overview</Text>
                    <Text style={styles.description}>{product.description || "Premium handcrafted quality."}</Text>

                    <View style={styles.quantityRow}>
                        <Text style={styles.sectionTitle}>Quantity</Text>
                        <View style={styles.picker}>
                            <TouchableOpacity onPress={() => quantity > 1 && setQuantity(quantity - 1)}>
                                <Ionicons name="remove-circle-outline" size={30} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.quantityText}>{quantity}</Text>
                            <TouchableOpacity onPress={() => setQuantity(quantity + 1)}>
                                <Ionicons name="add-circle-outline" size={30} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.cartButton} onPress={handleFinalSubmit}>
                        <Ionicons name={isCustomized ? "chatbubble-ellipses-outline" : "cart-outline"} size={20} color="#000" />
                        <Text style={styles.cartButtonText}>
                            {isCustomized ? "REQUEST QUOTE FROM ADMIN" : "ADD TO CART"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* THE ARCHITECT MODAL */}
            <Modal visible={isArchitectVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <Animated.View entering={SlideInDown.springify().damping(15)} exiting={SlideOutDown} style={styles.architectSheet}>
                        <View style={styles.sheetHeader}>
                            <View>
                                <Text style={styles.sheetTitle}>THE ARCHITECT</Text>
                                <Text style={styles.sheetSub}>Customizing {product.name}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsArchitectVisible(false)}>
                                <Ionicons name="close-circle" size={32} color="#1a1a1a" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalLabel}>ORDER NOTES</Text>
                            <TextInput 
                                style={styles.modalInput}
                                placeholder="Color preferences, message on cake, etc..."
                                multiline
                                value={customNotes}
                                onChangeText={setCustomNotes}
                            />

                            {/* WEDDING CAKE DELIVERY SECTION */}
                            {isWeddingCake && (
                                <>
                                    <Text style={styles.modalLabel}>DELIVERY LOCATION (WEDDING VENUE)</Text>
                                    <View style={styles.locationInputContainer}>
                                        <TextInput 
                                            style={[styles.modalInput, { flex: 1, height: 55, marginBottom: 0 }]}
                                            placeholder="Enter venue address..."
                                            value={deliveryAddress}
                                            onChangeText={setDeliveryAddress}
                                        />
                                        <TouchableOpacity style={styles.locationBtn} onPress={getCurrentLocation}>
                                            {isLocating ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="location" size={22} color="#fff" />}
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}

                            <Text style={styles.modalLabel}>EVENT DATE</Text>
                            <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
                                <Ionicons name="calendar" size={20} color="#4B0082" />
                                <Text style={styles.dateText}>{eventDate.toDateString()}</Text>
                            </TouchableOpacity>

                            {showDatePicker && (
                                <DateTimePicker
                                    value={eventDate}
                                    mode="date"
                                    minimumDate={minDate}
                                    onChange={(e, date) => { setShowDatePicker(false); if (date) setEventDate(date); }}
                                />
                            )}

                            <TouchableOpacity 
                                style={styles.applyBtn}
                                onPress={() => { setIsCustomized(true); setIsArchitectVisible(false); }}
                            >
                                <Text style={styles.applyBtnText}>SAVE CUSTOMIZATIONS</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </Animated.View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    loading: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    imageContainer: { width: width, height: width * 1.15, backgroundColor: '#0a0a0a', position: 'relative' },
    slide: { width: width, height: width * 1.15, position: 'relative' },
    mainImage: { width: '100%', height: '100%' },
    floatingBackBtn: { position: 'absolute', top: 58, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    heroHeading: { position: 'absolute', top: 58, left: 78, right: 20, paddingVertical: 4 },
    heroBrand: { color: '#FFD700', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
    heroName: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 4, textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
    
    // Slide overlay & text
    slideOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.65)',
        padding: 16,
        paddingBottom: 24,
    },
    badge: {
        backgroundColor: '#FFD700',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginBottom: 6,
    },
    badgeText: { color: '#000', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
    slideTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    slideSub: { color: '#ccc', fontSize: 13, marginTop: 3 },
    
    // Carousel Pagination Dots
    paginationContainer: {
        position: 'absolute',
        top: 15,
        right: 15,
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 6,
    },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
    activeDot: { backgroundColor: '#FFD700', width: 14 },
    
    // Main Content
    content: { padding: 20, paddingBottom: 40 },
    priceRow: { marginBottom: 20 },
    price: { color: '#fff', fontSize: 22, fontWeight: '500' },
    deliveryStatus: { color: '#FFD700', fontSize: 12, fontWeight: '600', marginTop: 4, fontStyle: 'italic' },
    customizeCard: { backgroundColor: '#111', padding: 18, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 10, borderWidth: 1, borderColor: '#333' },
    activeCustomCard: { borderColor: '#FFD700', backgroundColor: '#1a1a11' },
    customizeLeft: { flexDirection: 'row', alignItems: 'center' },
    iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 215, 0, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    customizeTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
    customizeSub: { color: '#666', fontSize: 12, marginTop: 2 },
    divider: { height: 1, backgroundColor: '#222', marginVertical: 25 },
    sectionTitle: { color: '#555', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
    description: { color: '#999', fontSize: 15, lineHeight: 24, marginBottom: 30 },
    
    // Bundle Inclusions List
    bundleList: { gap: 12 },
    bundleCard: { flexDirection: 'row', backgroundColor: '#111', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
    bundleThumb: { width: 50, height: 50, borderRadius: 8, backgroundColor: '#222' },
    bundleInfo: { marginLeft: 14, flex: 1 },
    bundleItemName: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    bundleItemDesc: { color: '#888', fontSize: 12, marginTop: 2 },
    
    // Quantity Row
    quantityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    picker: { flexDirection: 'row', alignItems: 'center' },
    quantityText: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginHorizontal: 20 },
    
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
    architectSheet: { backgroundColor: '#F4F7F9', height: height * 0.8, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25 },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    sheetTitle: { fontSize: 22, fontWeight: '900', color: '#1a1a1a' },
    sheetSub: { fontSize: 12, color: '#666', fontWeight: '600' },
    modalLabel: { fontSize: 10, fontWeight: '900', color: '#4B0082', marginBottom: 8, marginTop: 15, letterSpacing: 1 },
    modalInput: { backgroundColor: '#fff', borderRadius: 15, padding: 15, height: 100, textAlignVertical: 'top', color: '#000', fontSize: 14, borderWidth: 1, borderColor: '#eee' },
    locationInputContainer: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    locationBtn: { backgroundColor: '#4B0082', width: 55, height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    dateSelector: { backgroundColor: '#fff', padding: 18, borderRadius: 15, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
    dateText: { marginLeft: 10, fontWeight: '700', color: '#1a1a1a', flex: 1 },
    applyBtn: { backgroundColor: '#1a1a1a', padding: 20, borderRadius: 18, marginTop: 30, alignItems: 'center' },
    applyBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
    cartButton: { backgroundColor: '#FFD700', padding: 18, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 28, marginBottom: 20 },
    cartButtonText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 }
});