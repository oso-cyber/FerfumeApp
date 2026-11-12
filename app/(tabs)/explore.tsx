import { IconSymbol } from '@/components/ui/icon-symbol';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction
} from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { db } from '../../firebaseConfig';

const { width } = Dimensions.get('window');

// --- INTERFACES ---
interface BundleItem {
  name: string;
  imageUrl: string;
}

interface ProductSH {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  bundleItems?: BundleItem[];
  brand?: string;
  category?: string;
  discount?: number;
}

interface TrendingItem {
  id?: string;
  productId?: string;
  query: string;
  count: number;
  imageUrl: string;
  imageUrls?: string[];
}

interface CategoryM {
  id: string;
  name: string;
}

// --- COMPONENTS ---

const PackageCollage = ({ items, mainImage }: { items?: BundleItem[], mainImage: string }) => {
  if (!items || items.length === 0) {
    return <Image source={{ uri: mainImage }} style={styles.dealImage} />;
  }

  if (items.length === 3) {
    return (
      <View style={styles.fanContainer}>
        <Image 
          source={{ uri: items[0].imageUrl }} 
          style={[styles.fanImage, { transform: [{ rotate: '-12deg' }, { translateX: -30 }] }]} 
        />
        <Image 
          source={{ uri: items[2].imageUrl }} 
          style={[styles.fanImage, { transform: [{ rotate: '12deg' }, { translateX: 30 }] }]} 
        />
        <Image 
          source={{ uri: items[1].imageUrl }} 
          style={[styles.fanImage, styles.fanImageCenter]} 
        />
      </View>
    );
  }

  // Calculate items remaining beyond the 4 visible grid slots
  const remainingCount = items.length - 4;

  return (
    <View style={styles.collageContainer}>
      {items.length === 1 ? (
        <Image source={{ uri: items[0].imageUrl }} style={styles.collageFull} />
      ) : items.length === 2 ? (
        <View style={styles.row}>
          <Image source={{ uri: items[0].imageUrl }} style={styles.collageHalf} />
          <Image source={{ uri: items[1].imageUrl }} style={styles.collageHalf} />
        </View>
      ) : (
        // Case: 4 or more items (The Grid)
        <View style={styles.grid}>
          <View style={styles.row}>
            <Image source={{ uri: items[0].imageUrl }} style={styles.collageHalf} />
            <Image source={{ uri: items[1].imageUrl }} style={styles.collageHalf} />
          </View>
          <View style={styles.row}>
            <Image source={{ uri: items[2].imageUrl }} style={styles.collageHalf} />
            
            {/* The 4th Slot */}
            <View style={styles.collageHalf}>
              {/* Always show the 4th image (index 3) */}
              <Image source={{ uri: items[3].imageUrl }} style={StyleSheet.absoluteFill} />

              {/* ONLY show the "+" overlay if there are actually remaining items (5 or more total) */}
              {remainingCount > 0 && (
                <View style={[StyleSheet.absoluteFill, styles.moreOverlay]}>
                  <Text style={styles.moreText}>+{remainingCount}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const SeamlessCyclingIcon = ({ images, style }: { images: string[], style: any }) => {
  const [index, setIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const valid = images?.filter(img => img && img.trim() !== "");
    if (!valid || valid.length <= 1) return;

    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.4, duration: 500, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start();
      setIndex((prev) => (prev + 1) % valid.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [images]);

  const displayImg = images?.find(img => img !== "");
  if (!displayImg) return <View style={[style, { backgroundColor: '#eee' }]} />;

  return (
    <Animated.Image 
      source={{ uri: images[index] || displayImg }} 
      style={[style, { opacity: fadeAnim }]} 
    />
  );
};

// --- MAIN SCREEN ---

export default function ExploreScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [categories, setCategories] = useState<CategoryM[]>([]);
  const [initialDeals, setInitialDeals] = useState<ProductSH[]>([]);
  const [allProducts, setAllProducts] = useState<ProductSH[]>([]); 
  const [searchResults, setSearchResults] = useState<ProductSH[]>([]);
  const [suggestions, setSuggestions] = useState<ProductSH[]>([]);
  const [trending, setTrending] = useState<TrendingItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      setSearch('');
      setIsSearching(false);
      fetchInitialData();
    }, [])
  );

  const fetchInitialData = async () => {
    try {
      const trendQ = query(collection(db, "trending_queries"), orderBy("count", "desc"), limit(15));
      const catQ = query(collection(db, "categoriesM"), orderBy("name", "asc"));

      const [trendSnap, dealsSnap, prodSnap, catSnap] = await Promise.all([
        getDocs(trendQ),
        getDocs(collection(db, "packages_deals")),
        getDocs(collection(db, "products")),
        getDocs(catQ)
      ]);

      const products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductSH));
      const rawTrending = trendSnap.docs.map(d => ({ id: d.id, ...d.data() } as TrendingItem));

      // Filter trending to only items that actually exist in the DB
      const filteredTrending = rawTrending.filter(trend => 
        products.some(p => p.name.toLowerCase().includes(trend.query.toLowerCase()))
      ).slice(0, 5);

      setAllProducts(products);
      const uniqueTrending = filteredTrending.reduce<TrendingItem[]>((unique, item) => {
        const itemProduct = products.find(product =>
          item.productId === product.id ||
          (!!item.imageUrl && item.imageUrl === product.imageUrl) ||
          product.name.toLowerCase().includes(item.query.toLowerCase())
        );
        const duplicate = unique.find(existing => {
          if (itemProduct && existing.productId === itemProduct.id) return true;
          return !!item.imageUrl && existing.imageUrl === item.imageUrl;
        });

        if (!duplicate) {
          unique.push({ ...item, productId: item.productId || itemProduct?.id });
        } else if (item.count > duplicate.count) {
          duplicate.count = item.count;
        }
        return unique;
      }, []).slice(0, 5);

      setTrending(uniqueTrending);
      setInitialDeals(dealsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductSH)));
      setCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() } as CategoryM)));
    } catch (e) {
      console.error("Load Error", e);
    }
  };

  const recordSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    const cleanQuery = queryText.trim();
    const docId = cleanQuery.toLowerCase();

    const match = allProducts.find(p => 
      p.name.toLowerCase().includes(docId) ||
      p.brand?.toLowerCase().includes(docId) ||
      p.category?.toLowerCase().includes(docId)
    );
    if (!match) return; 

    const newImg = match.imageUrl || "";
    const newImgs = match.bundleItems?.map(b => b.imageUrl) || (newImg ? [newImg] : []);
    const existingTrend = trending.find(item =>
      item.productId === match.id || (!!newImg && item.imageUrl === newImg)
    );
    const trendDocRef = doc(db, "trending_queries", existingTrend?.id || docId);

    setTrending((current) => {
      const existing = current.find(item =>
        item.productId === match.id || (!!newImg && item.imageUrl === newImg)
      );
      const updatedItem: TrendingItem = {
        id: existing?.id || docId,
        productId: match.id,
        query: cleanQuery,
        count: (existing?.count || 0) + 1,
        imageUrl: newImg,
        imageUrls: newImgs,
      };

      return [
        updatedItem,
        ...current.filter(item => item !== existing && item.productId !== match.id && (!newImg || item.imageUrl !== newImg)),
      ].slice(0, 5);
    });

    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(trendDocRef);
        if (!snap.exists()) {
          transaction.set(trendDocRef, { 
            query: cleanQuery, 
            count: 1, 
            imageUrl: newImg, 
            imageUrls: newImgs,
            productId: match.id
          });
        } else {
          transaction.update(trendDocRef, { 
            count: increment(1),
            query: cleanQuery,
            productId: match.id,
            imageUrl: newImg || snap.data().imageUrl,
            imageUrls: newImgs.length > 0 ? newImgs : snap.data().imageUrls
          });
        }
      });
    } catch (e) { console.log("Trend Update Fail", e); }
  };

  const handleSearchInput = (text: string) => {
    setSearch(text);
    if (text.length > 1) {
      const filtered = allProducts.filter(p => 
        p.name.toLowerCase().includes(text.toLowerCase())
      ).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const performSearch = (queryText: string) => {
    if (!queryText.trim()) return;
    setIsSearching(true);
    setSuggestions([]);
    // Record the search as soon as it is submitted, without waiting for a product tap.
    recordSearch(queryText);
    
    const results = allProducts.filter(p => 
        p.name.toLowerCase().includes(queryText.toLowerCase()) || 
        p.brand?.toLowerCase().includes(queryText.toLowerCase()) ||
        p.category?.toLowerCase().includes(queryText.toLowerCase())
    );
    setSearchResults(results);
  };

  return (
    <View style={styles.mainWrapper}>
      <View style={styles.topSearchContainer}>
        <View style={styles.searchBar}>
          <IconSymbol name="magnifyingglass" size={18} color="#666" />
          <TextInput
            placeholder="Search for cakes..."
            placeholderTextColor="#888"
            style={styles.searchInput}
            value={search}
            onChangeText={handleSearchInput}
            onSubmitEditing={() => performSearch(search)}
          />
          {search.length > 0 && (
            <TouchableOpacity
              style={styles.clearSearchBtn}
              onPress={() => {
                setSearch('');
                setSuggestions([]);
                setIsSearching(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <IconSymbol name="xmark.circle.fill" size={18} color="#777" />
            </TouchableOpacity>
          )}
        </View>

        {suggestions.length > 0 && (
          <View style={styles.suggestionBox}>
            {suggestions.map((item) => (
              <TouchableOpacity key={item.id} style={styles.suggestionRow} onPress={() => {setSearch(item.name); performSearch(item.name);}}>
                <IconSymbol name="sparkle" size={14} color="#555" />
                <Text style={styles.suggestionText}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {!isSearching ? (
          <>
            <View style={styles.sectionContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {categories.map((cat) => (
                  <TouchableOpacity key={cat.id} style={styles.brandChip} onPress={() => performSearch(cat.name)}>
                    <Text style={styles.brandText}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {trending.length > 0 && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionHeading}>Trending Now</Text>
                <View style={styles.trendingFlex}>
                  {trending.map((item, index) => (
                    <TouchableOpacity key={index} style={styles.trendChip} onPress={() => performSearch(item.query)}>
                      <SeamlessCyclingIcon 
                        images={item.imageUrls && item.imageUrls.length > 0 ? item.imageUrls : [item.imageUrl]} 
                        style={styles.trendIcon} 
                      />
                      <View>
                         <Text style={styles.trendLabel}>{item.query}</Text>
                         <Text style={styles.countLabel}>{item.count} searches</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeading}>Exclusive Packages</Text>
              {initialDeals.map((deal) => (
                <TouchableOpacity key={deal.id} style={styles.dealCard} onPress={() => router.push({ pathname: '/ProductDetailScreen', params: { productId: deal.id } })}>
                  <PackageCollage items={deal.bundleItems} mainImage={deal.imageUrl} />
                  {deal.discount && (
                    <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>{deal.discount}% OFF</Text>
                    </View>
                  )}
                  <View style={styles.dealInfo}>
                    <Text style={styles.dealName}>{deal.name}</Text>
                    <Text style={styles.dealPrice}>R {deal.price}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeading}>Our Menu</Text>
              <View style={styles.productGrid}>
                {allProducts.map((product) => (
                  <TouchableOpacity 
                    key={product.id} 
                    style={styles.productCard} 
                    onPress={() => router.push({ pathname: '/ProductDetailScreen', params: { productId: product.id } })}
                  >
                    <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                      <Text style={styles.productPrice}>R {product.price}</Text>
                      <View style={styles.plusIconContainer}>
                         <IconSymbol name="plus.circle.fill" size={24} color="#fff" />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.sectionContainer}>
            <View style={styles.resultsHeader}>
              <View>
                <Text style={styles.resultsEyebrow}>EXPLORE RESULTS</Text>
                <Text style={styles.resultsTitle}>Your matches</Text>
                <View style={styles.queryPill}>
                  <IconSymbol name="magnifyingglass" size={12} color="#FFD700" />
                  <Text style={styles.queryText} numberOfLines={1}>{search.trim()}</Text>
                </View>
                <Text style={styles.resultCount}>
                  {searchResults.length} {searchResults.length === 1 ? 'item' : 'items'} found
                </Text>
              </View>
              <TouchableOpacity style={styles.clearResultsBtn} onPress={() => {setIsSearching(false); setSearch('');}}>
                <IconSymbol name="xmark" size={14} color="#FFD700" />
                <Text style={styles.clearBtn}>Clear</Text>
                </TouchableOpacity>
            </View>
            {searchResults.length > 0 ? searchResults.map(item => (
                <TouchableOpacity key={item.id} style={styles.resultRow} onPress={() => router.push({ pathname: '/ProductDetailScreen', params: { productId: item.id } })}>
                    <Image source={{ uri: item.imageUrl }} style={styles.resultThumb} />
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultBrand}>{item.brand || item.category || 'Bespoke selection'}</Text>
                      <Text style={styles.resultName} numberOfLines={2}>{item.name}</Text>
                      <Text style={styles.resultPrice}>R {item.price}</Text>
                    </View>
                    <View style={styles.resultArrow}>
                      <IconSymbol name="chevron.right" size={14} color="#FFD700" />
                    </View>
                </TouchableOpacity>
            )) : <Text style={styles.emptyText}>Nothing found.</Text>}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: '#000' },
  topSearchContainer: { paddingTop: 60, paddingHorizontal: 20, zIndex: 100 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 17, paddingHorizontal: 15, height: 54, borderWidth: 1, borderColor: '#242424' },
  searchInput: { flex: 1, color: '#fff', marginLeft: 10, fontSize: 16 },
  clearSearchBtn: { padding: 4, marginLeft: 6 },
  suggestionBox: { position: 'absolute', top: 115, left: 20, right: 20, backgroundColor: '#161616', borderRadius: 15, padding: 10, zIndex: 999, borderWidth: 1, borderColor: '#222' },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#222' },
  suggestionText: { color: '#fff', marginLeft: 15 },
  scrollContent: { paddingBottom: 120 },
  sectionContainer: { marginTop: 25, paddingHorizontal: 20 },
  sectionHeading: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 15 },
  trendingFlex: { flexDirection: 'row', flexWrap: 'wrap' },
  trendChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 25, marginRight: 10, marginBottom: 10 },
  trendIcon: { width: 30, height: 30, borderRadius: 15, marginRight: 10 },
  trendLabel: { color: '#000', fontSize: 13, fontWeight: '700' },
  countLabel: { color: '#666', fontSize: 10 },
  brandChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#111', marginRight: 10, borderWidth: 1, borderColor: '#222' },
  brandText: { color: '#fff', fontWeight: '600' },
  dealCard: { backgroundColor: '#0a0a0a', borderRadius: 25, marginBottom: 25, overflow: 'hidden', borderWidth: 1, borderColor: '#1a1a1a', position: 'relative' },
  dealInfo: { padding: 20 },
  dealName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  dealPrice: { color: '#fff', fontSize: 17, fontWeight: '300', marginTop: 8 },
  collageContainer: { width: '100%', height: 260, backgroundColor: '#111' },
  fanContainer: { width: '100%', height: 260, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  fanImage: { width: 140, height: 180, borderRadius: 15, position: 'absolute', borderWidth: 2, borderColor: '#000' },
  fanImageCenter: { zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 },
  collageFull: { width: '100%', height: '100%' },
  row: { flexDirection: 'row', flex: 1 },
  grid: { flex: 1 },
  collageHalf: { flex: 1, height: '100%', borderWidth: 0.5, borderColor: '#000' },
  moreOverlay: { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  moreText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  discountBadge: { position: 'absolute', top: 15, right: 15, backgroundColor: '#ff3b30', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, zIndex: 20 },
  discountText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  productCard: { width: (width - 50) / 2, backgroundColor: '#0a0a0a', borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: '#1a1a1a', overflow: 'hidden' },
  productImage: { width: '100%', height: 150, backgroundColor: '#111' },
  productInfo: { padding: 12, position: 'relative' },
  productName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  productPrice: { color: '#fff', fontSize: 15, fontWeight: '300', marginTop: 4 },
  plusIconContainer: { position: 'absolute', bottom: 12, right: 12, opacity: 0.8 },
  resultRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d0d0d', padding: 12, borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: '#1d1d1d' },
  resultThumb: { width: 74, height: 74, borderRadius: 14, marginRight: 14, backgroundColor: '#171717' },
  resultInfo: { flex: 1, minHeight: 70, justifyContent: 'center' },
  resultBrand: { color: '#FFD700', fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  resultName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  resultPrice: { color: '#aaa', fontSize: 13, marginTop: 5 },
  resultArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1c1c1c', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  clearBtn: { color: '#FFD700', fontSize: 12, fontWeight: '800' },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  resultsEyebrow: { color: '#FFD700', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 5 },
  resultsTitle: { color: '#fff', fontSize: 26, fontWeight: '900' },
  queryPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#17150a', borderWidth: 1, borderColor: '#3b3300', borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5, marginTop: 9, maxWidth: width * 0.62 },
  queryText: { color: '#FFD700', fontSize: 11, fontWeight: '700', marginLeft: 5 },
  resultCount: { color: '#666', fontSize: 11, marginTop: 8 },
  clearResultsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8, marginTop: 2 },
  emptyText: { color: '#777', textAlign: 'center', marginTop: 50, fontSize: 14 },
  dealImage: { width: '100%', height: 200, borderRadius: 15, backgroundColor: '#222', marginBottom: 10 },
});