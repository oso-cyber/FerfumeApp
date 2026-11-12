import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import { auth, db } from '../../firebaseConfig';

const { width } = Dimensions.get('window');

interface Product {
  id: string;
  name?: string;
  brand?: string;
  price?: number;
  imageUrl?: string;
  category?: string;
  description?: string;
}

interface CustomAlertData {
  title: string;
  message: string;
  buttons: Array<{
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
  }>;
}

const HeartButton = ({ isFavorite, onPress }: { isFavorite: boolean; onPress: () => void }) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(1.5, { damping: 2, stiffness: 80 }, () => {
      scale.value = withSpring(1);
    });
    onPress();
  };

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={handlePress} style={styles.heartContainer}>
      <Animated.View style={animatedStyle}>
        <Ionicons 
          name={isFavorite ? "heart" : "heart-outline"} 
          size={20} 
          color={isFavorite ? "#FF4B4B" : "#fff"} 
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function HomeScreen() {
  const router = useRouter();

  const snoozedOrders = useRef<string[]>([]);
  const shownAlerts = useRef<string[]>([]); 
  const shownSupportAlerts = useRef<string[]>([]);
  const supportInitialized = useRef(false);

  const [userName, setUserName] = useState<string>('Guest');
  const [address, setAddress] = useState<string>('Fetching location...');
  const [products, setProducts] = useState<Product[]>([]);
  const [popular, setPopular] = useState<Product[]>([]);
  const [search, setSearch] = useState<string>('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [readyQuoteCount, setReadyQuoteCount] = useState(0);
  const [hasUnreadSupport, setHasUnreadSupport] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  
  // Custom Alert Modal State to guarantee alerts show reliably
  const [customAlert, setCustomAlert] = useState<CustomAlertData | null>(null);

  const hasNotifications = readyQuoteCount > 0 || hasUnreadSupport;

  const formatEventDate = (value: any, isChanged = false) => {
    if (!value) return '📅 Date pending';

    try {
      const dateValue = value?.toDate ? value.toDate() : new Date(
        typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? `${value}T00:00:00`
          : value
      );

      if (Number.isNaN(dateValue.getTime())) return '📅 Date pending';

      const formatted = dateValue.toLocaleDateString('en-ZA', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      return `${isChanged ? '📅 DATE UPDATED: ' : '📅 Event date: '}${formatted}`;
    } catch {
      return '📅 Date pending';
    }
  };

  useEffect(() => {
    const userId = auth.currentUser?.uid;

    let unsubUser: () => void;
    if (userId) {
      unsubUser = onSnapshot(doc(db, "users", userId), (docSnap) => {
        if (docSnap.exists()) {
          setUserName(docSnap.data().fullName || 'Guest');
        }
      });
    }

    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
      setLoading(false);
    });

    const unsubPopular = onSnapshot(collection(db, "popular"), (snapshot) => {
      setPopular(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
    });

    let unsubDealWatcher: (() => void) | undefined;
    let unsubSupportWatcher: (() => void) | undefined;
    
    if (userId) {
      const qDeal = query(
        collection(db, "customer_orders"), 
        where("userId", "==", userId)
      );

      unsubDealWatcher = onSnapshot(qDeal, (snapshot) => {
        const activeDocs = snapshot.docs.filter(doc => {
          const status = doc.data().status;
          return status === "price_set" || status === "date_adjusted";
        });
        
        setReadyQuoteCount(activeDocs.length);
        const readyCount = activeDocs.length;

        // Process doc changes after snapshot hydration completes
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added" || change.type === "modified") {
            const orderId = change.doc.id;
            const orderData = change.doc.data();
            const hasPrice = orderData.price && Number(orderData.price) > 0;

            // --- 1. DATE ADJUSTED ALERT ---
            if (orderData.status === "date_adjusted") {
              const alertKey = `date_adj_${orderId}_${orderData.eventDate}`;
              if (!shownAlerts.current.includes(alertKey)) {
                shownAlerts.current.push(alertKey);
                  
                const buttons: CustomAlertData['buttons'] = [];
                const eventDateText = formatEventDate(orderData.eventDate, true);
                const isDateChanged = !!orderData.dateAdjustedByAdmin;

                if (hasPrice) {
                  buttons.push({ 
                    text: "Accept & Pay", 
                    onPress: () => handleAcceptDeal(orderId, orderData)
                  });
                }

                buttons.push({
                  text: "Inquire",
                  onPress: () => router.push({
                    pathname: '/chat',
                    params: {
                      orderId,
                      orderName: orderData.cakeType || orderData.name || 'Custom Order',
                      eventDate: orderData.eventDate || '',
                      quotePrice: orderData.price ? String(orderData.price) : '',
                      source: 'custom',
                      imageUrl: orderData.imageUrl || (orderData.images && orderData.images[0]) || '',
                      adminMessage: orderData.adminMessage || orderData.customNotes || '',
                    }
                  })
                });

                buttons.push({ 
                  text: "View Orders", 
                  onPress: () => router.push('/orders') 
                });

                buttons.push({ text: "OK", style: "cancel" });

                // Dispatch to Custom Alert Modal
                setTimeout(() => {
                  setCustomAlert({
                    title: isDateChanged ? "Date Changed 📅" : "Event Date Adjusted 📅",
                    message: `Your order "${orderData.cakeType || orderData.name || 'Custom Order'}"\n\n${eventDateText}${hasPrice ? `\n\nQuote: R${orderData.price}` : ''}\n\nIf you want to ask a question, tap Inquire.`,
                    buttons
                  });
                }, 400);
              }
            }

            // --- 2. PRICE SET (QUOTE READY) ALERT ---
            else if (orderData.status === "price_set") {
              if (shownAlerts.current.includes(orderId) || snoozedOrders.current.includes(orderId)) {
                return;
              }

              if (orderData.quoteNotificationSnoozed === true) {
                snoozedOrders.current.push(orderId);
                return;
              }

              shownAlerts.current.push(orderId);

              const buttons: CustomAlertData['buttons'] = [];
              const eventDateText = formatEventDate(orderData.eventDate, !!orderData.dateAdjustedByAdmin);
              const isDateChanged = !!orderData.dateAdjustedByAdmin;

              if (readyCount === 1) {
                buttons.push({ 
                  text: "Accept & Pay", 
                  onPress: () => handleAcceptDeal(orderId, orderData)
                });
              }

              buttons.push({
                text: "Inquire",
                onPress: () => router.push({
                  pathname: '/chat',
                  params: {
                    orderId,
                    orderName: orderData.cakeType || orderData.name || 'Custom Order',
                    eventDate: orderData.eventDate || '',
                    quotePrice: orderData.price ? String(orderData.price) : '',
                    source: 'custom',
                    imageUrl: orderData.imageUrl || (orderData.images && orderData.images[0]) || '',
                    adminMessage: orderData.adminMessage || orderData.customNotes || '',
                  }
                })
              });

              buttons.push({ 
                text: readyCount > 1 ? "View All Orders" : "View Details", 
                onPress: () => router.push('/orders')
              });

              buttons.push({ 
                text: "Later", 
                style: "cancel",
                onPress: async () => {
                  snoozedOrders.current.push(orderId);
                  await updateDoc(doc(db, "customer_orders", orderId), {
                    quoteNotificationSnoozed: true,
                  });
                }
              });

              // Dispatch to Custom Alert Modal
              setTimeout(() => {
                setCustomAlert({
                  title: readyCount > 1 ? "Multiple Quotes Ready! ✨" : isDateChanged ? "Quote Updated 📅" : "Custom Quote Ready! ✨",
                  message: readyCount > 1
                    ? `You have ${readyCount} custom quotes waiting for your approval.\n\n${eventDateText}`
                    : `Your request for "${orderData.cakeType || orderData.name || 'Custom Order'}" has been priced at R${orderData.price}.\n\n${eventDateText}\n\nIf you want to ask a question, tap Inquire.`,
                  buttons
                });
              }, 400);
            }
          }
        });
      });

      const qSupport = query(
        collection(db, "messages"),
        where("chatId", "==", userId)
      );

      unsubSupportWatcher = onSnapshot(qSupport, (snapshot) => {
        if (!supportInitialized.current) {
          supportInitialized.current = true;
          return;
        }

        const newIncomingMessages = snapshot.docChanges().filter(change =>
          change.type === "added" && change.doc.data().senderId !== userId
        );

        if (newIncomingMessages.length > 0) {
          setHasUnreadSupport(true);
        }

        newIncomingMessages.forEach((change) => {
          if (shownSupportAlerts.current.includes(change.doc.id)) return;

          shownSupportAlerts.current.push(change.doc.id);
          const message = change.doc.data();

          setTimeout(() => {
            setCustomAlert({
              title: "New Support Message",
              message: message.text || "You have a new message from support.",
              buttons: [
                { 
                  text: "Open Chat", 
                  onPress: () => {
                    setHasUnreadSupport(false);
                    router.push('/chat');
                  } 
                },
                { text: "Later", style: "cancel" }
              ]
            });
          }, 400);
        });
      });
    }

    let unsubWishlist: () => void;
    if (userId) {
      unsubWishlist = onSnapshot(collection(db, "users", userId, "wishlist"), (snapshot) => {
        setFavorites(snapshot.docs.map(doc => doc.id));
      });
    }

    requestLocation();

    return () => {
      unsubUser?.();
      unsubProducts();
      unsubPopular();
      unsubWishlist?.();
      unsubDealWatcher?.();
      unsubSupportWatcher?.();
    };
  }, []);

  const handleAcceptDeal = async (orderId: string, data: any) => {
    const userId = auth.currentUser?.uid;
    const userEmail = auth.currentUser?.email;
    
    if (!userId || !userEmail) return Alert.alert("Error", "Login required.");

    try {
      const customItem = {
        productId: orderId,
        name: `Custom: ${data.name || data.cakeType || 'Order'}`,
        price: Number(data.price),
        imageUrl: data.imageUrl || (data.images && data.images[0]) || "https://via.placeholder.com/150",
        images: data.images || [], 
        quantity: 1,
        isCustom: true,
        customNotes: data.customNotes || data.notes || "", 
        adminMessage: data.adminMessage || "",
        timestamp: serverTimestamp() 
      };

      const cartDocRef = doc(db, "users", userId, "cart", orderId);
      await setDoc(cartDocRef, customItem);

      await updateDoc(doc(db, "customer_orders", orderId), {
        status: "accepted_in_cart"
      });

      router.push({
        pathname: '/PaymentScreen',
        params: { 
          amount: data.price.toString(), 
          email: userEmail,
          customOrderId: orderId,
          cartItems: JSON.stringify([customItem]), 
          deliveryFee: "0",
          eventDate: data.eventDate || "" 
        }
      });
    } catch (e) {
      console.error("Home handleAccept Error:", e);
      Alert.alert("Error", "Could not process selection.");
    }
  };

  const openNotifications = () => {
    setNotificationsVisible(true);
  };

  const requestLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return setAddress('Permission denied');
      let location = await Location.getCurrentPositionAsync({});
      let reverseGeocode = await Location.reverseGeocodeAsync(location.coords);
      if (reverseGeocode.length > 0) {
        const addr = reverseGeocode[0];
        setAddress(`${addr.name || ''} ${addr.city || ''}`);
      }
    } catch (e) { setAddress('Location unavailable'); }
  };

  const toggleFavorite = async (product: Product) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const isAlreadyFav = favorites.includes(product.id);
    const favDocRef = doc(db, "users", userId, "wishlist", product.id);
    try {
      if (isAlreadyFav) {
        await deleteDoc(favDocRef);
      } else {
        await setDoc(favDocRef, {
          name: product.name,
          brand: product.brand || 'Bespoke',
          price: product.price,
          imageUrl: product.imageUrl,
          addedAt: serverTimestamp()
        });
      }
    } catch (error) { console.error(error); }
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    if (text.length > 0) {
      const filtered = products.filter(p =>
        p.name?.toLowerCase().includes(text.toLowerCase()) ||
        p.brand?.toLowerCase().includes(text.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 5));
    } else { setSuggestions([]); }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name?.toLowerCase().includes(search.toLowerCase()) || 
      p.brand?.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, products]);

  const navigateToProduct = (productId: string) => {
    setSearch('');
    setSuggestions([]);
    router.push({ pathname: '/ProductDetailScreen', params: { productId } });
  };

  if (loading) {
    return (
      <View style={[styles.mainWrapper, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.mainWrapper}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
      >
        <Animated.View entering={FadeInDown.duration(800)} style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.profileRow}>
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={24} color="#666" />
              </View>
              <View style={styles.welcomeInfo}>
                <Text style={styles.welcomeText}>Welcome back,</Text>
                <Text style={styles.userName}>{userName}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.notificationBtn} onPress={openNotifications}>
              <Ionicons name="notifications" size={20} color="#fff" />
              {hasNotifications && <View style={styles.notificationBadge} />}
            </TouchableOpacity>
          </View>

          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color="#666" />
            <Text style={styles.addressText} numberOfLines={1}>{address}</Text>
          </View>
        </Animated.View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#666" />
            <TextInput
              placeholder="Search perfumes & cakes..."
              placeholderTextColor="#444"
              style={styles.searchInput}
              value={search}
              onChangeText={handleSearch}
              onBlur={() => setTimeout(() => setSuggestions([]), 200)}
            />
          </View>

          {suggestions.length > 0 && (
            <View style={styles.suggestionOverlay}>
              {suggestions.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.suggestionItem}
                  onPress={() => navigateToProduct(item.id)} 
                >
                  <Text style={styles.suggestionText}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity 
            style={styles.customCakeBtn} 
            onPress={() => router.push('/CustomCakeScreen')}
          >
            <View style={styles.customCakeLeft}>
              <Ionicons name="sparkles" size={20} color="#FFD700" />
              <Text style={styles.customCakeText}>Design your Custom Cake</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>New <Text style={styles.titleBold}>Arrivals</Text></Text>
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filteredProducts}
          contentContainerStyle={{ paddingLeft: 20, paddingRight: 10 }}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInRight.delay(index * 150)}>
              <TouchableOpacity 
                style={styles.newArrivalCard}
                onPress={() => navigateToProduct(item.id)}
                activeOpacity={0.9}
              >
                <HeartButton 
                  isFavorite={favorites.includes(item.id)} 
                  onPress={() => toggleFavorite(item)} 
                />

                <View style={styles.topProductLeft}>
                  <Text style={styles.topProductTag}>{item.brand || "Bespoke"}</Text>
                  <Text style={styles.topProductTitle} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.topProductPrice}>
                    R{item.price ?? 0}
                    <Text style={styles.topProductUnit}> / unit</Text>
                  </Text>

                  <TouchableOpacity 
                    style={styles.addToCartBtn}
                    onPress={() => navigateToProduct(item.id)}
                  >
                    <Text style={styles.addToCartBtnText}>Add to Cart</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.topProductRight}>
                  <Image 
                    source={{ uri: item.imageUrl }} 
                    style={styles.topProductImage} 
                    contentFit="cover" 
                  />
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}
          keyExtractor={(item) => item.id}
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Most <Text style={styles.titleBold}>Popular</Text></Text>
        </View>
        
        <View style={styles.gridContainer}>
          {popular.map((item, index) => (
            <Animated.View 
              key={item.id} 
              entering={FadeInDown.delay(index * 100)}
              style={styles.popularCardWrapper}
            >
              <TouchableOpacity 
                style={styles.popularCard}
                onPress={() => navigateToProduct(item.id)}
              >
                <Image source={{ uri: item.imageUrl }} style={styles.cardImage} contentFit="cover" />
                <HeartButton 
                  isFavorite={favorites.includes(item.id)} 
                  onPress={() => toggleFavorite(item)} 
                />
                <View style={styles.textContainer}>
                  <Text style={styles.cardLabel}>{item.name}</Text>
                  <Text style={styles.priceTag}>R{item.price}</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      {/* Notifications Drawer */}
      <Modal
        visible={notificationsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotificationsVisible(false)}
      >
        <TouchableOpacity
          style={styles.notificationOverlay}
          activeOpacity={1}
          onPress={() => setNotificationsVisible(false)}
        >
          <TouchableOpacity
            style={styles.notificationPanel}
            activeOpacity={1}
            onPress={() => undefined}
          >
            <View style={styles.notificationPanelHeader}>
              <Text style={styles.notificationPanelTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setNotificationsVisible(false)}>
                <Ionicons name="close" size={22} color="#888" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.notificationRow}
              onPress={() => {
                setNotificationsVisible(false);
                router.push('/orders');
              }}
            >
              <Ionicons name="receipt-outline" size={22} color="#FFD700" />
              <View style={styles.notificationRowText}>
                <Text style={styles.notificationRowTitle}>Orders</Text>
                <Text style={styles.notificationRowSubtitle}>
                  {readyQuoteCount > 0 
                    ? `${readyQuoteCount} order${readyQuoteCount === 1 ? '' : 's'} updated or ready for payment` 
                    : 'No order action needed'}
                </Text>
              </View>
              {readyQuoteCount > 0 && <View style={styles.attentionDot} />}
              <Ionicons name="chevron-forward" size={18} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.notificationRow}
              onPress={() => {
                setHasUnreadSupport(false);
                setNotificationsVisible(false);
                router.push('/chat');
              }}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={22} color="#FFD700" />
              <View style={styles.notificationRowText}>
                <Text style={styles.notificationRowTitle}>Support Chat</Text>
                <Text style={styles.notificationRowSubtitle}>
                  {hasUnreadSupport ? 'New message from support' : 'No new support messages'}
                </Text>
              </View>
              {hasUnreadSupport && <View style={styles.attentionDot} />}
              <Ionicons name="chevron-forward" size={18} color="#666" />
            </TouchableOpacity>

            {!hasNotifications && (
              <Text style={styles.allCaughtUpText}>You are all caught up.</Text>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* CUSTOM ALERT MODAL - Ensures Quote Alerts Always Render */}
      <Modal
        visible={customAlert !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomAlert(null)}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>{customAlert?.title}</Text>
            <Text style={styles.alertMessage}>{customAlert?.message}</Text>
            
            <View style={styles.alertButtonGroup}>
              {customAlert?.buttons.map((btn, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.alertButton,
                    btn.style === 'cancel' ? styles.alertButtonCancel : styles.alertButtonPrimary
                  ]}
                  onPress={() => {
                    const action = btn.onPress;
                    setCustomAlert(null);
                    if (action) action();
                  }}
                >
                  <Text 
                    style={[
                      styles.alertButtonText,
                      btn.style === 'cancel' ? styles.alertTextCancel : styles.alertTextPrimary
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#000' },
  scrollContent: { paddingTop: 60, paddingBottom: 120 },
  header: { paddingHorizontal: 20, marginBottom: 20 },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  welcomeInfo: { marginLeft: 15 },
  welcomeText: { color: '#666', fontSize: 13 },
  userName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15, opacity: 0.7 },
  addressText: { color: '#888', fontSize: 12, marginLeft: 6, width: '80%' },
  searchContainer: { paddingHorizontal: 20, marginBottom: 25, zIndex: 100 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', borderRadius: 15, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: '#1a1a1a' },
  searchInput: { flex: 1, color: '#fff', marginLeft: 10, fontSize: 15 },
  suggestionOverlay: { backgroundColor: '#0a0a0a', borderBottomLeftRadius: 15, borderBottomRightRadius: 15, borderWidth: 1, borderColor: '#1a1a1a', position: 'absolute', top: 50, left: 0, right: 0, zIndex: 1000 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  suggestionText: { color: '#fff', marginLeft: 10 },
  customCakeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#121212', marginTop: 15, paddingHorizontal: 15, paddingVertical: 14, borderRadius: 15, borderWidth: 1, borderColor: '#1a1a1a' },
  customCakeLeft: { flexDirection: 'row', alignItems: 'center' },
  customCakeText: { color: '#fff', marginLeft: 10, fontWeight: '600', fontSize: 14 },
  sectionHeader: { paddingHorizontal: 20, marginVertical: 20 },
  sectionTitle: { color: '#fff', fontSize: 22, fontWeight: '300' },
  titleBold: { fontWeight: 'bold', color: '#fff' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 20 },
  
  newArrivalCard: { width: width * 0.82, height: 170, backgroundColor: '#141218', marginRight: 15, borderRadius: 24, flexDirection: 'row', padding: 14, position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: '#231F2A' },
  topProductLeft: { flex: 1.1, justifyContent: 'space-between', paddingRight: 10, zIndex: 2 },
  topProductTag: { color: '#FFD700', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  topProductTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', lineHeight: 20 },
  topProductPrice: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  topProductUnit: { color: '#8E8E93', fontSize: 11, fontWeight: 'normal' },
  addToCartBtn: { backgroundColor: '#FFFFFF', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, alignSelf: 'flex-start' },
  addToCartBtnText: { color: '#000000', fontWeight: 'bold', fontSize: 12 },
  topProductRight: { flex: 0.9, justifyContent: 'center', alignItems: 'center' },
  topProductImage: { width: '100%', height: '100%', borderRadius: 16 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  notificationOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 105, paddingHorizontal: 18 },
  notificationPanel: { width: '88%', backgroundColor: '#111', borderRadius: 18, borderWidth: 1, borderColor: '#2a2a2a', padding: 16, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, elevation: 12 },
  notificationPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  notificationPanelTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  notificationRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#222' },
  notificationRowText: { flex: 1, marginLeft: 12 },
  notificationRowTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  notificationRowSubtitle: { color: '#777', fontSize: 12, marginTop: 3 },
  attentionDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#FF3B30', marginRight: 12 },
  allCaughtUpText: { color: '#666', fontSize: 13, paddingTop: 14, textAlign: 'center' },
  popularCardWrapper: { width: (width - 55) / 2, marginBottom: 15 },
  popularCard: { height: 250, backgroundColor: '#111', borderRadius: 25, overflow: 'hidden' },
  cardImage: { width: '100%', height: '100%', position: 'absolute', opacity: 0.8 },
  heartContainer: { position: 'absolute', top: 15, right: 15, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.4)', padding: 8, borderRadius: 20 },
  textContainer: { flex: 1, justifyContent: 'flex-end', padding: 15, backgroundColor: 'rgba(0,0,0,0.3)' },
  cardLabel: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cardBrand: { color: '#ccc', fontSize: 12 },
  priceTag: { color: '#fff', fontSize: 16, fontWeight: '900' },

  /* Custom Alert Styles */
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24
  },
  alertBox: {
    width: '100%',
    backgroundColor: '#161618',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#2D2D30',
    alignItems: 'center',
    elevation: 20
  },
  alertTitle: {
    color: '#FFF',
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10
  },
  alertMessage: {
    color: '#AAA',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20
  },
  alertButtonGroup: {
    width: '100%',
    gap: 10
  },
  alertButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  alertButtonPrimary: {
    backgroundColor: '#FFD700'
  },
  alertButtonCancel: {
    backgroundColor: '#262628'
  },
  alertButtonText: {
    fontSize: 15,
    fontWeight: '700'
  },
  alertTextPrimary: {
    color: '#000'
  },
  alertTextCancel: {
    color: '#888'
  }
});