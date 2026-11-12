import { auth, db } from '@/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    LayoutAnimation,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 50) / 2;

interface WishlistItem {
    id: string;
    name: string;
    price: number;
    imageUrl: string;
    brand?: string;
}

export default function WishlistScreen() {
    const router = useRouter();
    const [items, setItems] = useState<WishlistItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        const wishlistRef = collection(db, "users", userId, "wishlist");
        const productsRef = collection(db, "products");

        // Listen to wishlist and cross-reference with master products
        const unsubscribeWishlist = onSnapshot(query(wishlistRef), (wishlistSnap) => {
            // We nested the products listener so that any change in the store 
            // instantly updates the user's wishlist view
            const unsubscribeProducts = onSnapshot(productsRef, (productSnap) => {
                // Map out valid product IDs currently in the store
                const activeProductIds = productSnap.docs.map(doc => doc.id);

                const data = wishlistSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as WishlistItem))
                    // FILTER: Only keep items that still exist in the main products collection
                    .filter(item => activeProductIds.includes(item.id));

                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setItems(data);
                setLoading(false);
            });

            return () => unsubscribeProducts();
        });

        return () => unsubscribeWishlist();
    }, []);

    const removeItem = async (itemId: string) => {
        const userId = auth.currentUser?.uid;
        if (userId) {
            try {
                await deleteDoc(doc(db, "users", userId, "wishlist", itemId));
            } catch (error) {
                console.error("Remove Error:", error);
            }
        }
    };

    const addToCart = async (item: WishlistItem) => {
        const userId = auth.currentUser?.uid;
        if (!userId) {
            Alert.alert("Identity Required", "Please sign in to curate your bag.");
            return;
        }

        try {
            const cartRef = doc(db, "users", userId, "cart", item.id);
            
            await setDoc(cartRef, {
                id: item.id,
                name: item.name,
                price: item.price,
                imageUrl: item.imageUrl,
                quantity: 1,
                timestamp: serverTimestamp(),
            }, { merge: true });

            Alert.alert("Added to Bag", `${item.name} is ready for checkout.`);
        } catch (error) {
            console.error("Cart Sync Error:", error);
            Alert.alert("Error", "We couldn't update your bag. Try again.");
        }
    };

    if (loading) return (
        <View style={styles.centered}>
            <ActivityIndicator size="large" color="#FFD700" />
        </View>
    );

    return (
        <View style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.roundBtn}>
                    <Ionicons name="chevron-back" size={22} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>THE VAULT</Text>
                    <Text style={styles.headerSubtitle}>{items.length} SAVED PIECES</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/cart')} style={styles.roundBtn}>
                    <Ionicons name="bag-handle-outline" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            {items.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="heart-outline" size={60} color="#333" />
                    <Text style={styles.emptyTitle}>Vault Empty</Text>
                    <Text style={styles.emptyDesc}>Your curated collection will appear here.</Text>
                    <TouchableOpacity style={styles.exploreBtn} onPress={() => router.push('/')}>
                        <Text style={styles.exploreBtnText}>EXPLORE SHOP</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={styles.row}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item, index }) => (
                        <Animated.View entering={FadeInDown.delay(index * 100).springify()}>
                            <TouchableOpacity 
                                style={styles.card}
                                onPress={() => router.push({ pathname: '/ProductDetailScreen', params: { productId: item.id } })}
                            >
                                <Image source={{ uri: item.imageUrl }} style={styles.image} />
                                <View style={styles.overlay}>
                                    <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(item.id)}>
                                        <Ionicons name="close" size={16} color="#fff" />
                                    </TouchableOpacity>

                                    <View style={styles.cardDetails}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.brandText}>{item.brand || 'ELDO VILLAGE'}</Text>
                                            <Text style={styles.nameText} numberOfLines={1}>{item.name}</Text>
                                            <Text style={styles.priceText}>R {item.price}</Text>
                                        </View>
                                        <TouchableOpacity 
                                            style={styles.quickAddBtn}
                                            onPress={() => addToCart(item)}
                                        >
                                            <Ionicons name="bag-add" size={18} color="#000" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </Animated.View>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    centered: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
    roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a' },
    headerTextContainer: { alignItems: 'center' },
    headerTitle: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 4 },
    headerSubtitle: { color: '#FFD700', fontSize: 10, fontWeight: 'bold', marginTop: 4 },
    listContent: { paddingHorizontal: 15, paddingBottom: 120 },
    row: { justifyContent: 'space-between' },
    card: { width: COLUMN_WIDTH, height: COLUMN_WIDTH * 1.5, borderRadius: 25, marginBottom: 20, backgroundColor: '#0a0a0a', overflow: 'hidden', borderWidth: 1, borderColor: '#1a1a1a' },
    image: { width: '100%', height: '100%', position: 'absolute' },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)', justifyContent: 'space-between', padding: 12 },
    removeBtn: { alignSelf: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    cardDetails: { backgroundColor: 'rgba(0,0,0,0.85)', padding: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
    quickAddBtn: { backgroundColor: '#FFD700', width: 34, height: 34, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
    brandText: { color: '#FFD700', fontSize: 8, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
    nameText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginVertical: 2 },
    priceText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 20, letterSpacing: 2, textTransform: 'uppercase' },
    emptyDesc: { color: '#666', fontSize: 12, textAlign: 'center', marginTop: 8 },
    exploreBtn: { marginTop: 30, paddingVertical: 15, paddingHorizontal: 30, backgroundColor: '#FFD700', borderRadius: 15 },
    exploreBtnText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
});