import { auth, db } from '@/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';

import {
    collection,
    deleteDoc,
    doc,
    increment,
    onSnapshot,
    orderBy,
    query,
    updateDoc
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    LayoutAnimation,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    UIManager,
    View
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const HOME_LAT = -25.8444;
const HOME_LON = 28.1581;

interface CartItem {
    id: string;
    productId: string;
    name: string;
    price: number;
    imageUrl: string;
    quantity: number;
    isPackage?: boolean;
    bundleItems?: any[]; 
}

interface AddressItem {
    id: string;
    street: string;
    suburb: string;
    latitude?: number;
    longitude?: number;
    isDefault?: boolean;
}

const CartItemCollage = React.memo(function CartItemCollage({ item }: { item: CartItem }) {
    const images = useMemo(() => {
        if (item.isPackage && Array.isArray(item.bundleItems) && item.bundleItems.length > 0) {
            const extracted = item.bundleItems
                .map((b) => b.imageUrl || b.image)
                .filter(Boolean) as string[];
            if (extracted.length > 0) return extracted;
        }
        return [item.imageUrl].filter(Boolean) as string[];
    }, [item.imageUrl, JSON.stringify(item.bundleItems)]);

    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (images.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
        }, 3000);

        return () => clearInterval(interval);
    }, [images]);

    const currentUri = images[currentIndex] || item.imageUrl;

    return (
        <View style={collageStyles.container}>
            {currentUri ? (
                <Image
                    source={{ uri: currentUri }}
                    style={collageStyles.image}
                />
            ) : null}

            {images.length > 1 && (
                <View style={collageStyles.badge}>
                    <Ionicons name="layers" size={10} color="#000" />
                    <Text style={collageStyles.badgeText}>{images.length}</Text>
                </View>
            )}
        </View>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.item.imageUrl === nextProps.item.imageUrl &&
        JSON.stringify(prevProps.item.bundleItems) === JSON.stringify(nextProps.item.bundleItems)
    );
});

export default function CartScreen() {
    const router = useRouter();
    
    const [userName, setUserName] = useState<string>('Valued Guest');
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isHalted, setIsHalted] = useState(false); 
    const [processingId, setProcessingId] = useState<string | null>(null);

    // --- DELIVERY & ADDRESS STATE ---
    const [isDeliverySelected, setIsDeliverySelected] = useState(true);
    const [savedAddresses, setSavedAddresses] = useState<AddressItem[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
    const [addressesLoading, setAddressesLoading] = useState(true);
    const [deliveryFee, setDeliveryFee] = useState(850);
    const [distanceKm, setDistanceKm] = useState(0);

    // Fetch user details, system status, and saved addresses
    useEffect(() => {
        const userId = auth.currentUser?.uid;
        const unsubHalt = onSnapshot(doc(db, "settings", "global"), (docSnap) => {
            if (docSnap.exists()) {
                setIsHalted(docSnap.data().emergencyHalt);
            }
        });

        let unsubUser: () => void;
        let unsubAddresses: () => void;

        if (userId) {
            unsubUser = onSnapshot(doc(db, "users", userId), (docSnap) => {
                if (docSnap.exists()) {
                    setUserName(docSnap.data().fullName || 'Valued Guest');
                }
            });

            // Stream user's saved addresses
            const addrRef = collection(db, "users", userId, "addresses");
            unsubAddresses = onSnapshot(addrRef, (snapshot) => {
                const addrs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AddressItem[];
                setSavedAddresses(addrs);
                if (addrs.length > 0 && !selectedAddressId) {
                    const defaultAddr = addrs.find(a => a.isDefault) || addrs[0];
                    setSelectedAddressId(defaultAddr.id);
                }
                setAddressesLoading(false);
            });
        } else {
            setAddressesLoading(false);
        }

        return () => {
            unsubHalt();
            if (unsubUser) unsubUser();
            if (unsubAddresses) unsubAddresses();
        };
    }, []);

    const selectedAddress = useMemo(() => {
        return savedAddresses.find(a => a.id === selectedAddressId) || savedAddresses[0] || null;
    }, [savedAddresses, selectedAddressId]);

    const calculateDistance = (lat2: number, lon2: number) => {
        const R = 6371; 
        const dLat = (lat2 - HOME_LAT) * (Math.PI / 180);
        const dLon = (lon2 - HOME_LON) * (Math.PI / 180);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(HOME_LAT * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))); 
    };

    // Calculate delivery pricing based on selected address coordinates
    useEffect(() => {
        if (!selectedAddress) return;

        const updateFee = async () => {
            let lat = selectedAddress.latitude;
            let lon = selectedAddress.longitude;

            // Geocode on the fly if coordinates aren't explicitly saved
            if (!lat || !lon) {
                try {
                    const fullQuery = `${selectedAddress.street}, ${selectedAddress.suburb}, Gauteng`;
                    const geocoded = await Location.geocodeAsync(fullQuery);
                    if (geocoded.length > 0) {
                        lat = geocoded[0].latitude;
                        lon = geocoded[0].longitude;
                    }
                } catch (e) {
                    console.log("Geocoding failed for address", e);
                }
            }

            if (lat && lon) {
                const km = calculateDistance(lat, lon);
                setDistanceKm(km);
                let price = 850;
                if (km > 15) { price = 850 + ((km - 15) * 25); }
                if (price > 2000) price = 2000; 
                setDeliveryFee(price);
            } else {
                setDistanceKm(0);
                setDeliveryFee(850);
            }
        };

        updateFee();
    }, [selectedAddress]);

    const availableDates = useMemo(() => {
        const dates = [];
        const startDay = new Date();
        startDay.setDate(startDay.getDate() + 7);
        for (let i = 0; i < 14; i++) {
            const current = new Date(startDay);
            current.setDate(startDay.getDate() + i);
            dates.push({
                fullDate: current.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }),
                dayName: current.toLocaleDateString('en-US', { weekday: 'short' }),
                dayNumber: current.getDate().toString(),
            });
        }
        return dates;
    }, []);

    const [selectedDate, setSelectedDate] = useState(availableDates[0].fullDate);

    useEffect(() => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        const cartRef = collection(db, "users", userId, "cart");
        const q = query(cartRef, orderBy("timestamp", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CartItem[];
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setCartItems(items);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const updateQuantity = async (itemId: string, change: number, currentQty: number) => {
        const userId = auth.currentUser?.uid;
        if (!userId || processingId === itemId) return;
        if (currentQty + change <= 0) { removeItem(itemId); return; }
        setProcessingId(itemId);
        try {
            await updateDoc(doc(db, "users", userId, "cart", itemId), { quantity: increment(change) });
        } catch (e) {
            Alert.alert("Error", "Could not update quantity");
        } finally {
            setProcessingId(null);
        }
    };

    const removeItem = async (itemId: string) => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;
        Alert.alert("Remove Item", "Remove this from your selection?", [
            { text: "Cancel", style: "cancel" },
            { text: "Remove", style: "destructive", onPress: async () => {
                try { await deleteDoc(doc(db, "users", userId, "cart", itemId)); } catch (error) { console.error(error); }
            }}
        ]);
    };

    // Deep check if any cart item or bundled package item contains "wedding"
    const hasWeddingItem = useMemo(() => {
        return cartItems.some((item) => {
            const mainNameMatch = (item.name || '').toLowerCase().includes('wedding');
            if (mainNameMatch) return true;

            if (item.isPackage && Array.isArray(item.bundleItems)) {
                return item.bundleItems.some((bundleItem) => {
                    const bundleName = (bundleItem.name || bundleItem.title || '').toLowerCase();
                    const bundleCategory = (bundleItem.category || '').toLowerCase();
                    return bundleName.includes('wedding') || bundleCategory.includes('wedding');
                });
            }

            return false;
        });
    }, [cartItems]);

    const subtotal = useMemo(() => 
        cartItems.reduce((acc, item) => acc + ((item.price || 0) * (item.quantity || 1)), 0),
    [cartItems]);

    const totalWithDelivery = subtotal + (isDeliverySelected ? (hasWeddingItem ? deliveryFee : 0) : 0);

    const handleCheckout = () => {
        const userEmail = auth.currentUser?.email;
        if (!userEmail) { Alert.alert("Login Required", "Please sign in."); return; }

        if (isDeliverySelected && hasWeddingItem && !selectedAddress) {
            Alert.alert("Address Required", "Please add a delivery address to proceed.");
            return;
        }

        const formattedAddress = selectedAddress 
            ? `${selectedAddress.street}, ${selectedAddress.suburb}` 
            : "STUDIO COLLECTION";

        router.push({
            pathname: '/PaymentScreen',
            params: { 
                amount: Math.round(totalWithDelivery).toString(), 
                email: userEmail,
                eventDate: selectedDate,
                cartItems: JSON.stringify(cartItems), 
                deliveryFee: (isDeliverySelected && hasWeddingItem) ? deliveryFee.toString() : "0",
                address: (isDeliverySelected && hasWeddingItem) ? formattedAddress : "STUDIO COLLECTION",
                lat: (isDeliverySelected && hasWeddingItem) ? (selectedAddress?.latitude?.toString() || "0") : "0",
                lon: (isDeliverySelected && hasWeddingItem) ? (selectedAddress?.longitude?.toString() || "0") : "0"
            }
        });
    };

    if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#FFD700" /></View>;

    if (isHalted) {
        return (
            <View style={styles.haltedWrapper}>
                <Ionicons name="lock-closed-outline" size={80} color="#FFD700" />
                <Text style={styles.haltedTitle}>CONCIERGE OFFLINE</Text>
                <Text style={styles.haltedSubtitle}>Checkout is temporarily paused to ensure our existing quality standards.</Text>
                <TouchableOpacity style={styles.haltedBtn} onPress={() => router.replace('/')}><Text style={styles.haltedBtnText}>VIEW CATALOGUE</Text></TouchableOpacity>
            </View>
        );
    }

    if (cartItems.length === 0) {
        return (
            <View style={styles.centered}>
                <Ionicons name="basket-outline" size={100} color="#1a1a1a" />
                <Text style={styles.emptyTitle}>EMPTY PALETTE</Text>
                <Text style={styles.emptySubtitle}>Your curated selection is waiting to be started.</Text>
                <TouchableOpacity style={styles.checkoutButton} onPress={() => router.replace('/')}>
                    <Text style={styles.checkoutText}>EXPLORE PIECES</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.mainWrapper}>
            <StatusBar barStyle="light-content" />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                
                <View style={styles.headerContainer}>
                    <View>
                        <Text style={styles.headerTitle}>Selection</Text>
                        <Text style={styles.userNameText}>CURATED FOR {userName.toUpperCase()}</Text>
                    </View>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.dateLabel}>RESERVATION DATE</Text>
                    <Text style={styles.leadTimeText}>7-Day Lead Time</Text>
                </View>
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                    {availableDates.map((item) => (
                        <TouchableOpacity
                            key={item.fullDate}
                            onPress={() => setSelectedDate(item.fullDate)}
                            style={[styles.dateCard, selectedDate === item.fullDate && styles.dateCardActive]}
                        >
                            <Text style={[styles.dateDay, selectedDate === item.fullDate && styles.textBlack]}>{item.dayName}</Text>
                            <Text style={[styles.dateNumber, selectedDate === item.fullDate && styles.textBlack]}>{item.dayNumber}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <View style={styles.divider} />

                {cartItems.map((item) => (
                    <View key={item.id} style={[styles.cartItemRow, item.isPackage && styles.packageCardMain]}>
                        <View style={styles.rowTop}>
                            <CartItemCollage item={item} />
                            
                            <View style={styles.itemInfo}>
                                <View style={styles.titleRow}>
                                    <Text style={styles.itemName} numberOfLines={1}>{item.name || "Custom Piece"}</Text>
                                    <TouchableOpacity onPress={() => removeItem(item.id)}>
                                        <Ionicons name="close-circle" size={20} color="#333" />
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.itemPrice}>R {(item.price || 0).toLocaleString()}</Text>
                                <View style={styles.bottomRow}>
                                    <View style={styles.quantityControls}>
                                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, -1, item.quantity || 1)}>
                                            <Ionicons name="remove" size={16} color="#fff" />
                                        </TouchableOpacity>
                                        <Text style={styles.qtyText}>{item.quantity || 1}</Text>
                                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.id, 1, item.quantity || 1)}>
                                            <Ionicons name="add" size={16} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={styles.itemTotal}>R {((item.price || 0) * (item.quantity || 1)).toLocaleString()}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                ))}

                {hasWeddingItem && (
                    <View style={styles.switchRow}>
                        <View>
                            <Text style={styles.switchLabel}>REQUEST ELITE DELIVERY</Text>
                            <Text style={styles.switchSub}>{isDeliverySelected ? "Doorstep specialist transport" : "Self-collection from Studio"}</Text>
                        </View>
                        <Switch 
                            value={isDeliverySelected} 
                            onValueChange={setIsDeliverySelected}
                            trackColor={{ false: "#1a1a1a", true: "#FFD700" }}
                            thumbColor={"#fff"}
                        />
                    </View>
                )}

                {isDeliverySelected && hasWeddingItem && (
                    <View style={styles.deliverySection}>
                        <View style={styles.deliveryHeaderRow}>
                            <Text style={styles.deliverySectionLabel}>DELIVERY ADDRESS</Text>
                            <TouchableOpacity onPress={() => router.push('/AddAddressModal')}>
                                <Text style={styles.addAddressText}>+ ADD NEW</Text>
                            </TouchableOpacity>
                        </View>

                        {addressesLoading ? (
                            <ActivityIndicator size="small" color="#FFD700" style={{ marginVertical: 15 }} />
                        ) : savedAddresses.length === 0 ? (
                            <View style={styles.noAddressContainer}>
                                <Ionicons name="location-outline" size={32} color="#666" />
                                <Text style={styles.noAddressTitle}>NO SAVED ADDRESSES</Text>
                                <Text style={styles.noAddressSub}>Add a destination in Gauteng to calculate delivery fees.</Text>
                                <TouchableOpacity 
                                    style={styles.addAddressButton} 
                                    onPress={() => router.push('/AddAddressModal')}
                                >
                                    <Ionicons name="add" size={18} color="#000" />
                                    <Text style={styles.addAddressBtnText}>ADD ADDRESS</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.addressListScroll}>
                                    {savedAddresses.map((addr) => {
                                        const isSelected = addr.id === selectedAddressId;
                                        return (
                                            <TouchableOpacity
                                                key={addr.id}
                                                style={[styles.addressCard, isSelected && styles.addressCardSelected]}
                                                onPress={() => setSelectedAddressId(addr.id)}
                                            >
                                                <Ionicons 
                                                    name={isSelected ? "checkmark-circle" : "location-outline"} 
                                                    size={18} 
                                                    color={isSelected ? "#000" : "#888"} 
                                                />
                                                <Text style={[styles.addressStreet, isSelected && styles.textBlack]} numberOfLines={1}>
                                                    {addr.street}
                                                </Text>
                                                <Text style={[styles.addressSuburb, isSelected && styles.textBlack]} numberOfLines={1}>
                                                    {addr.suburb}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>

                                {selectedAddress && (
                                    <View style={styles.deliveryMetricsBox}>
                                        <View style={styles.metricItem}>
                                            <Text style={styles.metricLabel}>DISTANCE</Text>
                                            <Text style={styles.metricValue}>{distanceKm.toFixed(1)} KM</Text>
                                        </View>
                                        <View style={styles.metricItem}>
                                            <Text style={styles.metricLabel}>SURCHARGE</Text>
                                            <Text style={styles.metricValue}>R {deliveryFee.toFixed(0)}</Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                )}

                <View style={styles.summarySection}>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal</Text>
                        <Text style={styles.summaryValue}>R {subtotal.toLocaleString()}</Text>
                    </View>
                    {isDeliverySelected && hasWeddingItem && (
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Transport</Text>
                            <Text style={styles.summaryValue}>R {deliveryFee.toLocaleString()}</Text>
                        </View>
                    )}
                    <View style={styles.totalRow}>
                        <Text style={styles.totalPrice}>R {totalWithDelivery.toLocaleString()}</Text>
                        <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
                            <Text style={styles.checkoutText}>CONFIRM</Text>
                            <Ionicons name="chevron-forward" size={18} color="#000" />
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const collageStyles = StyleSheet.create({
    container: {
        width: 90,
        height: 90,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#151515',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
        borderRadius: 20,
    },
    badge: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: '#FFD700',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    badgeText: {
        color: '#000',
        fontSize: 9,
        fontWeight: '900',
    },
});

const styles = StyleSheet.create({
    mainWrapper: { flex: 1, backgroundColor: '#000' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', padding: 30 },
    scrollContent: { padding: 20, paddingTop: 60, paddingBottom: 150 },
    divider: { height: 1, backgroundColor: '#1a1a1a', marginVertical: 25 },
    headerContainer: { marginBottom: 30 },
    headerTitle: { color: '#fff', fontSize: 34, fontWeight: '900' },
    userNameText: { color: '#FFD700', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    dateLabel: { color: '#666', fontSize: 11, fontWeight: '900' },
    leadTimeText: { color: '#444', fontSize: 10 },
    dateScroll: { marginBottom: 10 },
    dateCard: { padding: 18, borderRadius: 20, backgroundColor: '#0a0a0a', marginRight: 12, alignItems: 'center', minWidth: 80 },
    dateCardActive: { backgroundColor: '#fff' },
    dateDay: { color: '#666', fontSize: 12 },
    dateNumber: { color: '#fff', fontSize: 22, fontWeight: '900' },
    textBlack: { color: '#000' },
    cartItemRow: { backgroundColor: '#0a0a0a', padding: 15, borderRadius: 28, marginBottom: 18 },
    packageCardMain: { borderColor: '#FFD700', borderWidth: 1 },
    itemInfo: { flex: 1, marginLeft: 15 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between' },
    itemName: { color: '#fff', fontWeight: '800', fontSize: 16 },
    itemPrice: { color: '#FFD700', fontSize: 14 },
    bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    quantityControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 12, padding: 4 },
    qtyBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: '#222', borderRadius: 8 },
    qtyText: { color: '#fff', marginHorizontal: 12 },
    itemTotal: { color: '#fff', fontWeight: '900' },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#0a0a0a', borderRadius: 20, marginBottom: 15 },
    switchLabel: { color: '#fff', fontSize: 12, fontWeight: '900' },
    switchSub: { color: '#666', fontSize: 10 },
    
    // Delivery & Saved Address Styles
    deliverySection: { marginBottom: 25 },
    deliveryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    deliverySectionLabel: { color: '#666', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
    addAddressText: { color: '#FFD700', fontSize: 11, fontWeight: '800' },
    noAddressContainer: { backgroundColor: '#0a0a0a', borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#111' },
    noAddressTitle: { color: '#fff', fontSize: 13, fontWeight: '900', marginTop: 8 },
    noAddressSub: { color: '#666', fontSize: 11, textAlign: 'center', marginTop: 4, marginBottom: 15 },
    addAddressButton: { backgroundColor: '#FFD700', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 5 },
    addAddressBtnText: { color: '#000', fontSize: 12, fontWeight: '900' },
    addressListScroll: { marginBottom: 12 },
    addressCard: { backgroundColor: '#0a0a0a', padding: 15, borderRadius: 18, marginRight: 10, width: 160, borderWidth: 1, borderColor: '#1a1a1a' },
    addressCardSelected: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
    addressStreet: { color: '#fff', fontWeight: '800', fontSize: 13, marginTop: 8 },
    addressSuburb: { color: '#666', fontSize: 11, marginTop: 2 },
    deliveryMetricsBox: { backgroundColor: '#0a0a0a', padding: 15, borderRadius: 18, flexDirection: 'row', justifyContent: 'space-around', borderWidth: 1, borderColor: '#1a1a1a' },
    metricItem: { alignItems: 'center', flex: 1 },
    rowTop: { flexDirection: 'row', alignItems: 'center' },
    metricLabel: { color: '#666', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
    metricValue: { color: '#FFD700', fontSize: 16, fontWeight: '900', marginTop: 2 },
    
    summarySection: { backgroundColor: '#0a0a0a', padding: 25, borderRadius: 30 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    summaryLabel: { color: '#666' },
    summaryValue: { color: '#fff' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, borderTopWidth: 1, borderTopColor: '#1a1a1a', paddingTop: 15 },
    totalPrice: { color: '#FFD700', fontSize: 26, fontWeight: '900' },
    checkoutButton: { backgroundColor: '#fff', paddingHorizontal: 25, paddingVertical: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center' },
    checkoutText: { color: '#000', fontWeight: '900' },
    haltedWrapper: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 40 },
    haltedTitle: { color: '#FFD700', fontSize: 24, fontWeight: '900', marginTop: 20 },
    haltedSubtitle: { color: '#666', textAlign: 'center', marginTop: 10 },
    haltedBtn: { marginTop: 30 },
    haltedBtnText: { color: '#fff', fontWeight: '900', borderBottomWidth: 1, borderBottomColor: '#FFD700' },
    emptyTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 20 },
    emptySubtitle: { color: '#666', marginTop: 10, marginBottom: 20 },
});