import { db } from '@/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface OrderItem {
  id?: string;
  name?: string;
  price?: number;
  quantity?: number;
  imageUrl?: string;
  image?: string;
  images?: string[];
}

interface OrderDetail {
  id: string;
  status?: string;
  totalAmount?: number;
  total?: number;
  subtotal?: number;
  deliveryFee?: number;
  items?: OrderItem[];
  deliveryAddress?: string;

  // Custom AI Direct & Nested Root Fields
  name?: string;
  title?: string;
  cakeType?: string;
  description?: string;
  notes?: string;
  customNotes?: string;
  prompt?: string;
  price?: number;
  amount?: number;
  imageUrl?: string;
  image?: string;
  generatedImage?: string;
  designUrl?: string;
  referenceImages?: string[];
  images?: string[];
  creationType?: 'ai' | 'manual';
  cakeDetails?: {
    type?: string;
    image?: string;
  };
  [key: string]: any;
}

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

export default function OrderDetailsScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let unsubscribe: () => void = () => {};

    const resolveOrderDoc = async () => {
      // Determine primary vs fallback collections
      const primaryCollection = source === 'custom' ? 'customer_orders' : 'orders';
      const secondaryCollection = primaryCollection === 'orders' ? 'customer_orders' : 'orders';

      const primaryDocRef = doc(db, primaryCollection, id);

      unsubscribe = onSnapshot(primaryDocRef, async (docSnap) => {
        if (docSnap.exists()) {
          setOrder({ id: docSnap.id, ...docSnap.data() } as OrderDetail);
          setLoading(false);
        } else {
          try {
            const altSnap = await getDoc(doc(db, secondaryCollection, id));
            if (altSnap.exists()) {
              setOrder({ id: altSnap.id, ...altSnap.data() } as OrderDetail);
            } else {
              setOrder(null);
            }
          } catch (error) {
            console.error('Error fetching fallback order:', error);
            setOrder(null);
          } finally {
            setLoading(false);
          }
        }
      }, (error) => {
        console.error("Error listening to order doc:", error);
        setLoading(false);
      });
    };

    resolveOrderDoc();

    return () => unsubscribe();
  }, [id, source]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color="#666" />
        <Text style={{ color: '#fff', marginTop: 12, fontSize: 16 }}>Order not found.</Text>
      </View>
    );
  }

  // --- HELPER RESOLVERS FOR AI / CUSTOM DATA ---
  const resolveImage = (item?: OrderItem): string | null => {
    if (item?.imageUrl) return item.imageUrl;
    if (item?.image) return item.image;
    if (item?.images?.length) return item.images.find((image) => !!image) || null;
    if (order.imageUrl) return order.imageUrl;
    if (order.image) return order.image;
    if (order.generatedImage) return order.generatedImage;
    if (order.designUrl) return order.designUrl;
    if (order.referenceImages && order.referenceImages.length > 0) return order.referenceImages[0];
    if (order.images?.length) return order.images.find((image) => !!image) || null;
    if (order.cakeDetails?.image) return order.cakeDetails.image;
    return null;
  };

  const resolveTitle = (): string => {
    if (order.name) return order.name;
    if (order.cakeType) return order.cakeType;
    if (order.title) return order.title;
    if (order.cakeDetails?.type) return order.cakeDetails.type;
    return order.creationType === 'ai' || order.prompt ? "Custom AI Cake Design" : "Store Item";
  };

  // --- NORMALIZE ITEMS & PRICES ---
  const displayItems: OrderItem[] =
    order.items && order.items.length > 0
      ? order.items
      : [
          {
            id: order.id,
            name: resolveTitle(),
            price: order.price ?? order.totalAmount ?? order.amount ?? 0,
            quantity: 1,
            imageUrl: resolveImage() || '',
          },
        ];

  // Pricing Logic
  const deliveryFee = order.deliveryFee ?? 0;
  const itemsSubtotal = displayItems.reduce((sum, item) => {
    const itemPrice = Number(item.price) || 0;
    const itemQty = Number(item.quantity) || 1;
    return sum + itemPrice * itemQty;
  }, 0);

  const subtotal = order.subtotal ?? itemsSubtotal;
  const totalPaid = order.totalAmount ?? order.total ?? order.amount ?? (subtotal + deliveryFee);
  const isQuotePending = typeof order.price === 'undefined' && typeof order.totalAmount === 'undefined' && typeof order.amount === 'undefined';

  // Status Tracker Mapping
  const steps = ['Pending', 'Baking', 'Ready', 'Delivering', 'Completed'];
  const normalizeStatus = (st?: string) => {
    const s = (st || '').toLowerCase();
    if (s === 'accepted_in_cart' || s === 'active' || s === 'paid' || s === 'awaiting_admin' || s === 'price_set' || s === 'quote_ready') return 'Pending';
    if (s === 'baking' || s === 'processing') return 'Baking';
    if (s === 'ready' || s === 'dispatched') return 'Ready';
    if (s === 'delivering') return 'Delivering';
    if (s === 'completed' || s === 'delivered') return 'Completed';
    return 'Pending';
  };

  const formattedStatus = normalizeStatus(order.status);
  const currentStepIndex = steps.indexOf(formattedStatus);

  const aiPromptText = order.prompt || order.description || order.notes || order.customNotes;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.floatingBackBtn}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.orderIntro}>
          <Text style={styles.orderEyebrow}>YOUR ORDER</Text>
          <Text style={styles.orderTitle} numberOfLines={2}>{resolveTitle()}</Text>
          <Text style={styles.orderId}>Order #{order.id.slice(-8).toUpperCase()}</Text>
        </View>

        {/* STATUS TRACKER */}
        <View style={styles.trackerContainer}>
          <Text style={styles.orderStatusText}>
            Status: {(order.status || 'Pending').replace('_', ' ').toUpperCase()}
          </Text>
          <View style={styles.stepIndicatorRow}>
            {steps.map((step, index) => (
              <React.Fragment key={step}>
                <View
                  style={[
                    styles.stepDot,
                    index <= currentStepIndex ? styles.stepDotActive : styles.stepDotInactive,
                  ]}
                />
                {index < steps.length - 1 && (
                  <View
                    style={[
                      styles.stepLine,
                      index < currentStepIndex ? styles.stepLineActive : styles.stepLineInactive,
                    ]}
                  />
                )}
              </React.Fragment>
            ))}
          </View>
          <View style={styles.stepLabels}>
            <Text style={styles.stepLabel}>Ordered</Text>
            <Text style={styles.stepLabel}>Delivered</Text>
          </View>
        </View>

        {/* AI SPEC / PROMPT CARD (If custom AI Order) */}
        {aiPromptText && (
          <View style={styles.aiCard}>
            <View style={styles.aiCardHeader}>
              <Ionicons name="sparkles" size={16} color="#FFD700" />
              <Text style={styles.aiCardTitle}>Design Specification / Instructions</Text>
            </View>
            <Text style={styles.aiPromptBody}>{aiPromptText}</Text>
          </View>
        )}

        {/* ITEMS LIST */}
        <Text style={styles.sectionTitle}>Your Selection</Text>
        {displayItems.map((item, index) => {
          const price = Number(item.price) || 0;
          const quantity = Number(item.quantity) || 1;
          const imgUri = resolveImage(item);

          return (
            <View key={item.id || index} style={styles.itemRow}>
              {imgUri ? (
                <Image source={{ uri: normalizeFirebaseImageUrl(imgUri) || undefined }} style={styles.itemImage} resizeMode="cover" />
              ) : (
                <View style={[styles.itemImage, styles.placeholderImage]}>
                  <Ionicons name="cube-outline" size={24} color="#555" />
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name || 'Custom Order'}</Text>
                <Text style={styles.itemQty}>Quantity: {quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>
                {price > 0 ? `R ${(price * quantity).toFixed(2)}` : 'Quote Pending'}
              </Text>
            </View>
          );
        })}

        <View style={styles.divider} />

        {/* DELIVERY INFO */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color="#FFD700" />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.infoLabel}>Delivery Address</Text>
              <Text style={styles.infoValue}>
                {order.deliveryAddress || 'Pickup / Store Collection'}
              </Text>
            </View>
          </View>
        </View>

        {/* PRICE SUMMARY */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              {subtotal > 0 ? `R ${subtotal.toFixed(2)}` : 'Pending'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text style={styles.summaryValue}>R {deliveryFee.toFixed(2)}</Text>
          </View>
          <View
            style={[
              styles.summaryRow,
              { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#222' },
            ]}
          >
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>
              {isQuotePending && totalPaid === 0 ? 'Quote Pending' : `R ${totalPaid.toFixed(2)}`}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.reorderBtn}
          onPress={() => Alert.alert('Order Support', 'Contacting team for this order...')}
        >
          <Text style={styles.reorderText}>Contact Support for Order</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  floatingBackBtn: {
    position: 'absolute',
    top: 58,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: { padding: 20, paddingTop: 118 },
  orderIntro: { marginBottom: 22, paddingHorizontal: 4 },
  orderEyebrow: { color: '#FFD700', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
  orderTitle: { color: '#fff', fontSize: 27, fontWeight: '900', lineHeight: 32 },
  orderId: { color: '#666', fontSize: 11, marginTop: 8, letterSpacing: 1 },

  // Tracker
  trackerContainer: {
    backgroundColor: '#0a0a0a',
    padding: 25,
    borderRadius: 25,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  orderStatusText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  stepIndicatorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 },
  stepDot: { width: 10, height: 10, borderRadius: 5 },
  stepDotActive: { backgroundColor: '#FFD700' },
  stepDotInactive: { backgroundColor: '#333' },
  stepLine: { height: 2, flex: 1 },
  stepLineActive: { backgroundColor: '#FFD700' },
  stepLineInactive: { backgroundColor: '#333' },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  stepLabel: { color: '#444', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },

  // AI Prompt Card
  aiCard: {
    backgroundColor: '#0f0d03',
    borderColor: '#332a00',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 25,
  },
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  aiCardTitle: { color: '#FFD700', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  aiPromptBody: { color: '#ccc', fontSize: 13, lineHeight: 18 },

  sectionTitle: { color: '#666', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 15, letterSpacing: 1 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  itemImage: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#111' },
  placeholderImage: { justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  itemInfo: { flex: 1, marginLeft: 15 },
  itemName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  itemQty: { color: '#666', fontSize: 13, marginTop: 2 },
  itemPrice: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  divider: { height: 1, backgroundColor: '#111', marginVertical: 20 },

  infoSection: { marginBottom: 30 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoLabel: { color: '#666', fontSize: 12, textTransform: 'uppercase' },
  infoValue: { color: '#fff', fontSize: 14, marginTop: 2, fontWeight: '500' },

  summaryCard: { backgroundColor: '#0a0a0a', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#111' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { color: '#666', fontSize: 14 },
  summaryValue: { color: '#fff', fontSize: 14 },
  totalLabel: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  totalValue: { color: '#FFD700', fontSize: 20, fontWeight: 'bold' },

  reorderBtn: { marginTop: 30, backgroundColor: '#FFD700', padding: 18, borderRadius: 15, alignItems: 'center', marginBottom: 40 },
  reorderText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});