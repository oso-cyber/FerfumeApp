import { auth, db } from '@/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    LayoutAnimation,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface OrderItem {
    name?: string;
    title?: string;
    quantity?: number;
    image?: string;
    imageUrl?: string;
    images?: string[];
    selectedImage?: string;
    photoUrl?: string;
    url?: string;
    product?: {
        imageUrl?: string;
        image?: string;
    };
    price?: number;
}

interface Order {
    id: string;
    status: string;
    name?: string;
    cakeType?: string;
    title?: string;
    description?: string;
    notes?: string;
    prompt?: string;
    imageUrl?: string;
    image?: string;
    generatedImage?: string;
    designUrl?: string;
    referenceImages?: string[];
    images?: string[];
    price?: number;
    totalAmount?: number;
    amount?: number;
    items?: OrderItem[];
    timestamp: any;
    creationType?: 'ai' | 'manual';
    _source: 'custom' | 'standard';
    [key: string]: any; 
}

type TabType = 'pending' | 'active' | 'completed';

const normalizedStatus = (status?: string) => (status || '').trim().toLowerCase();
const isCompletedStatus = (status?: string) => {
    const normalized = normalizedStatus(status);
    return normalized === 'completed' || normalized === 'delivered';
};

const normalizeFirebaseImageUrl = (url?: string | null) => {
    if (!url) return null;

    const match = url.match(/\/o\/([^?]+)/);
    if (!match) return url;

    try {
        return url.replace(match[1], encodeURIComponent(decodeURIComponent(match[1])));
    } catch {
        return url;
    }
};

export default function OrdersScreen() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>('pending');
    const [loading, setLoading] = useState(true);

    const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
    const [activeOrders, setActiveOrders] = useState<Order[]>([]);
    const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
    const [carouselIndices, setCarouselIndices] = useState<Record<string, number>>({});

    useEffect(() => {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            setLoading(false);
            return;
        }
        setLoading(true);

        // 1. Listen to CUSTOM REQUESTS
        const qPending = query(
            collection(db, "customer_orders"),
            where("userId", "==", userId)
        );

        // 2. Listen to STORE / STANDARD CHECKOUT ORDERS
        const qFulfillment = query(
            collection(db, "orders"),
            where("customerId", "==", userId)
        );

        const unsubPending = onSnapshot(qPending, (snap) => {
            const data = snap.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(), 
                _source: 'custom' 
            })) as Order[];

            data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

            const pending = data.filter(o => {
                const s = normalizedStatus(o.status);
                return !isCompletedStatus(o.status) && (s === 'pending' || s === 'awaiting_admin' || s === 'price_set' || s === 'quote_ready' || s === '');
            });
            const completed = data.filter(o => isCompletedStatus(o.status));

            setPendingOrders(pending);
            setCompletedOrders(current => [
                ...current.filter(order => order._source !== 'custom'),
                ...completed,
            ]);
        }, (error) => {
            console.error("Error listening to pending orders:", error);
        });

        const unsubFulfillment = onSnapshot(qFulfillment, (snap) => {
            const allData = snap.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(), 
                _source: 'standard' 
            })) as Order[];
            
            allData.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            
            const active = allData.filter(o => {
                const s = normalizedStatus(o.status);
                return !isCompletedStatus(o.status) && s !== 'cancelled';
            });

            const completed = allData.filter(o => isCompletedStatus(o.status));

            setActiveOrders(active);
            setCompletedOrders(current => [
                ...current.filter(order => order._source !== 'standard'),
                ...completed,
            ]);
            setLoading(false);
        }, (error) => {
            console.error("Error listening to fulfillment orders:", error);
            setLoading(false);
        });

        return () => {
            unsubPending();
            unsubFulfillment();
        };
    }, []);

    const getStatusColor = (status: string) => {
        const normalized = (status || '').toLowerCase();
        switch (normalized) {
            case 'price_set': 
            case 'quote_ready': return '#FFD700';      
            case 'awaiting_admin': 
            case 'pending': return '#FFA500';    
            case 'active': 
            case 'baking': 
            case 'processing': return '#FFD700';         
            case 'delivering': 
            case 'dispatched': return '#00C851';     
            case 'completed': 
            case 'delivered': return '#4CAF50';         
            default: return '#888';
        }
    };

    const getCurrentData = () => {
        if (activeTab === 'pending') return pendingOrders;
        if (activeTab === 'active') return activeOrders;
        return completedOrders;
    };

    const getOrderImage = (item: Order) => {
    // 1. Root level checks (AI / Custom requests)
    if (item.imageUrl) return item.imageUrl;
    if (item.image) return item.image;
    if (item.generatedImage) return item.generatedImage;
    if (item.designUrl) return item.designUrl;
    if (item.referenceImages && item.referenceImages.length > 0) return item.referenceImages[0];
    if (item.images && item.images.length > 0) return item.images[0];
    if (item.cakeDetails?.image) return item.cakeDetails.image;

    // 2. Nested Array checks (Standard Store / Checkout Orders)
    if (item.items && item.items.length > 0) {
        const firstItem: any = item.items[0];
        if (!firstItem) return null;

        return (
            firstItem.imageUrl ||
            firstItem.image ||
            firstItem.images?.find((image: string) => image) ||
            firstItem.selectedImage ||
            firstItem.photoUrl ||
            firstItem.url ||
            firstItem.product?.imageUrl ||
            firstItem.product?.image ||
            null
        );
    }

    return null;
};

    const getCarouselItems = (item: Order) => {
        if (item._source === 'standard' && item.items && item.items.length > 1) {
            return item.items.map(orderItem => ({
                image: orderItem.imageUrl ||
                    orderItem.image ||
                    orderItem.images?.find(image => !!image) ||
                    orderItem.selectedImage ||
                    orderItem.photoUrl ||
                    orderItem.url ||
                    orderItem.product?.imageUrl ||
                    orderItem.product?.image,
                name: orderItem.name || orderItem.title || 'Item',
                quantity: orderItem.quantity,
            }));
        }

        const customImages = item.images?.filter(image => !!image) ||
            item.items?.[0]?.images?.filter(image => !!image) || [];

        return customImages.map((image, index) => ({
            image,
            name: `${item.name || 'Custom concept'} ${index + 1}`,
            quantity: undefined,
        }));
    };

    const getOrderTitle = (item: Order) => {
        if (item.name) return item.name;
        if (item.cakeType) return item.cakeType;
        if (item.title) return item.title;
        if (item.cakeDetails?.type) return item.cakeDetails.type;

        if (item.items && item.items.length > 0) {
            const firstItem = item.items[0];
            const firstName = firstItem?.name || firstItem?.title || "Standard Item";
            const totalItems = item.items.reduce((acc, curr) => acc + (curr.quantity || 1), 0);
            
            if (totalItems > 1) {
                return `${firstName} (+${totalItems - 1} more)`;
            }
            return firstName;
        }

        return item._source === 'custom' ? "Custom AI Cake Design" : "Store Order";
    };

    const getOrderDescription = (item: Order) => {
        if (item.description || item.notes || item.prompt) {
            return item.description || item.notes || item.prompt;
        }

        if (item.items && item.items.length > 0) {
            return item.items
                .map(i => `${i.quantity || 1}x ${i.name || i.title || 'Item'}`)
                .join(', ');
        }

        return null;
    };

    const formatDate = (rawDate: any) => {
        if (!rawDate) return 'Recently';
        try {
            if (rawDate?.toDate) {
                return rawDate.toDate().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
            }
            return new Date(rawDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (e) {
            return 'Recently';
        }
    };

    const handlePayNow = async (order: Order) => {
        const user = auth.currentUser;
        if (!user?.email || !order.price || order._source !== 'custom') {
            return;
        }

        try {
            const images = order.images?.filter(image => !!image) || [];
            const customItem = {
                productId: order.id,
                name: `Custom: ${order.name || order.cakeType || 'Custom Build Request'}`,
                price: Number(order.price),
                imageUrl: order.imageUrl || images[0] || '',
                images,
                quantity: 1,
                isCustom: true,
                customNotes: order.customNotes || order.notes || '',
                adminMessage: order.adminMessage || '',
                status: 'price_set',
                timestamp: serverTimestamp(),
            };

            await setDoc(doc(db, 'users', user.uid, 'cart', order.id), customItem);
            await updateDoc(doc(db, 'customer_orders', order.id), {
                status: 'accepted_in_cart',
            });

            router.push({
                pathname: '/PaymentScreen',
                params: {
                    amount: String(order.price),
                    email: user.email,
                    customOrderId: order.id,
                    cartItems: JSON.stringify([customItem]),
                    deliveryFee: String(order.deliveryFee || 0),
                    address: order.deliveryAddress || '',
                    eventDate: order.eventDate || '',
                },
            });
        } catch (error) {
            console.error('Error starting quote payment:', error);
        }
    };

    return (
        <View style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Order Architect</Text>
                <View style={{ width: 28 }} />
            </View>

            {/* STATUS TABS */}
            <View style={styles.tabContainer}>
                {(['pending', 'active', 'completed'] as TabType[]).map((tab) => (
                    <TouchableOpacity 
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.activeTab]} 
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                            {tab.toUpperCase()} ({
                                tab === 'pending' ? pendingOrders.length :
                                tab === 'active' ? activeOrders.length : completedOrders.length
                            })
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.centered}><ActivityIndicator size="large" color="#FFD700" /></View>
            ) : (
                <FlatList
                    data={getCurrentData()}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="receipt-outline" size={60} color="#1a1a1a" />
                            <Text style={styles.emptyTitle}>No {activeTab} orders</Text>
                            <Text style={styles.emptySub}>Nothing found in this section.</Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const imageUri = getOrderImage(item);
                        const carouselItems = getCarouselItems(item);
                        const titleText = getOrderTitle(item);
                        const descriptionText = getOrderDescription(item);
                        const isAiGenerated = item.creationType === 'ai' || !!item.prompt;
                        const itemQuantityCount = item.items?.reduce((acc, curr) => acc + (curr.quantity || 1), 0) || 0;
                        const finalPrice = item.price ?? item.totalAmount ?? item.amount;

                        return (
                            <TouchableOpacity 
                                style={styles.orderCard}
                                onPress={() => router.push({ 
                                    pathname: '/order-details' as any, 
                                    params: { id: item.id, source: item._source } 
                                })}
                            >
                                {/* TOP ROW: SOURCE TAG & STATUS BADGE */}
                                <View style={styles.cardTopRow}>
                                    <View style={styles.sourceTag}>
                                        <Text style={styles.orderNumber}>
                                            {item._source === 'custom' 
                                                ? (isAiGenerated ? "AI CUSTOM QUOTE" : "CUSTOM QUOTE") 
                                                : `STORE ORDER #${item.id.slice(-6).toUpperCase()}`}
                                        </Text>
                                    </View>
                                    <View style={[styles.statusBadge, { borderColor: getStatusColor(item.status) }]}>
                                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                                            {(item.status || 'Active').replace('_', ' ')}
                                        </Text>
                                    </View>
                                </View>

                                {/* MIDDLE ROW: IMAGE CAROUSEL & DETAILS */}
                                <View>
                                    {/* Items Carousel (for standard orders with multiple items) */}
                                    {carouselItems.length > 1 ? (
                                        <View style={styles.carouselContainer}>
                                            <FlatList
                                                data={carouselItems}
                                                keyExtractor={(_, idx) => `${item.id}-item-${idx}`}
                                                horizontal
                                                scrollEnabled={carouselItems.length > 3}
                                                scrollEventThrottle={16}
                                                onScroll={(e) => {
                                                    const offset = e.nativeEvent.contentOffset.x;
                                                    const idx = Math.round(offset / 80);
                                                    setCarouselIndices(prev => ({ ...prev, [item.id]: idx }));
                                                }}
                                                snapToInterval={80}
                                                decelerationRate="fast"
                                                showsHorizontalScrollIndicator={false}
                                                renderItem={({ item: orderItem }) => {
                                                    const itemImage = orderItem.image;

                                                    return (
                                                        <View style={styles.carouselItem}>
                                                            {itemImage ? (
                                                                <Image source={{ uri: normalizeFirebaseImageUrl(itemImage) || undefined }} style={styles.carouselImage} />
                                                            ) : (
                                                                <View style={styles.carouselImagePlaceholder}>
                                                                    <Ionicons name="image-outline" size={20} color="#444" />
                                                                </View>
                                                            )}
                                                            <Text style={styles.carouselItemName} numberOfLines={1}>
                                                                {(orderItem as any).name || (orderItem as any).title || 'Item'}
                                                            </Text>
                                                            {(orderItem as any).quantity && (
                                                                <Text style={styles.carouselItemQty}>x{(orderItem as any).quantity}</Text>
                                                            )}
                                                        </View>
                                                    );
                                                }}
                                            />
                                            {/* Carousel Indicator */}
                                            <View style={styles.carouselIndicator}>
                                                <Text style={styles.carouselIndicatorText}>
                                                    {(carouselIndices[item.id] || 0) + 1} of {carouselItems.length}
                                                </Text>
                                            </View>
                                        </View>
                                    ) : (
                                        /* Single image display for custom orders or single-item standard orders */
                                        <View style={styles.cardBody}>
                                            {imageUri ? (
                                                <Image source={{ uri: normalizeFirebaseImageUrl(imageUri) || undefined }} style={styles.thumbnail} />
                                            ) : (
                                                <View style={styles.thumbnailPlaceholder}>
                                                    <Ionicons name="bag-handle-outline" size={24} color="#444" />
                                                </View>
                                            )}

                                            <View style={styles.detailsContainer}>
                                                <Text style={styles.itemName}>{titleText}</Text>
                                                
                                                {descriptionText ? (
                                                    <Text style={styles.descriptionText} numberOfLines={2}>
                                                        {descriptionText}
                                                    </Text>
                                                ) : null}

                                                <View style={styles.metaRow}>
                                                    {itemQuantityCount > 0 && (
                                                        <View style={styles.itemBadge}>
                                                            <Text style={styles.itemBadgeText}>{itemQuantityCount} {itemQuantityCount === 1 ? 'ITEM' : 'ITEMS'}</Text>
                                                        </View>
                                                    )}
                                                    <Text style={styles.orderDate}>
                                                        {item.status === 'price_set' 
                                                            ? "🔥 Price ready - Action required" 
                                                            : `Updated: ${formatDate(item.timestamp)}`}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    )}
                                </View>

                                {/* BOTTOM ROW: PRICE & ACTION */}
                                <View style={styles.orderFooter}>
                                    <Text style={styles.orderTotal}>
                                        {typeof finalPrice === 'number' 
                                            ? `R ${finalPrice.toLocaleString()}` 
                                            : 'Quote Pending'}
                                    </Text>
                                    <View style={styles.footerActions}>
                                        {item._source === 'custom' && item.status?.toLowerCase() === 'price_set' && (
                                            <TouchableOpacity
                                                style={styles.payNowBtn}
                                                onPress={() => handlePayNow(item)}
                                            >
                                                <Ionicons name="card-outline" size={14} color="#000" />
                                                <Text style={styles.payNowText}>PAY NOW</Text>
                                            </TouchableOpacity>
                                        )}
                                        <View style={styles.viewBtn}>
                                            <Text style={styles.viewBtnText}>DETAILS</Text>
                                            <Ionicons name="chevron-forward" size={14} color="#FFD700" />
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 10 },
    headerTitle: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' },
    tabContainer: { flexDirection: 'row', backgroundColor: '#0a0a0a', marginHorizontal: 20, marginTop: 15, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#1a1a1a' },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    activeTab: { backgroundColor: '#FFD700' },
    tabText: { color: '#444', fontWeight: 'bold', fontSize: 10 },
    activeTabText: { color: '#000' },
    listContent: { padding: 20 },
    orderCard: { backgroundColor: '#080808', borderRadius: 20, padding: 18, marginBottom: 15, borderWidth: 1, borderColor: '#151515' },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sourceTag: { flex: 1 },
    orderNumber: { color: '#FFD700', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    statusBadge: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
    cardBody: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    thumbnail: { width: 68, height: 68, borderRadius: 12, backgroundColor: '#151515' },
    thumbnailPlaceholder: { width: 68, height: 68, borderRadius: 12, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
    detailsContainer: { flex: 1 },
    itemName: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
    descriptionText: { color: '#aaa', fontSize: 12, marginTop: 4, lineHeight: 16 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    itemBadge: { backgroundColor: '#1a1a1a', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#333' },
    itemBadgeText: { color: '#FFD700', fontSize: 9, fontWeight: 'bold' },
    orderDate: { color: '#666', fontSize: 11 },
    orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#111' },
    orderTotal: { color: '#fff', fontSize: 18, fontWeight: '900' },
    footerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    payNowBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFD700', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
    payNowText: { color: '#000', fontSize: 10, fontWeight: '900' },
    viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    viewBtnText: { color: '#FFD700', fontSize: 12, fontWeight: 'bold' },
    emptyState: { alignItems: 'center', marginTop: 100 },
    emptyTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 20 },
    emptySub: { color: '#444', textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },
    carouselContainer: { marginBottom: 12 },
    carouselItem: { width: 80, marginRight: 8, alignItems: 'center', justifyContent: 'center' },
    carouselImage: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#151515', marginBottom: 6 },
    carouselImagePlaceholder: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#222', marginBottom: 6 },
    carouselItemName: { color: '#fff', fontSize: 11, fontWeight: '600', textAlign: 'center', width: 80 },
    carouselItemQty: { color: '#FFD700', fontSize: 9, fontWeight: 'bold', marginTop: 2 },
    carouselIndicator: { paddingHorizontal: 8, paddingVertical: 6, alignSelf: 'flex-start', marginLeft: 12, marginTop: 8, backgroundColor: '#1a1a1a', borderRadius: 6, borderWidth: 1, borderColor: '#333' },
    carouselIndicatorText: { color: '#FFD700', fontSize: 10, fontWeight: 'bold' }
});