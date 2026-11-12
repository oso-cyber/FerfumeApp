import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import Slider from '@react-native-community/slider';
import Animated, {
    FadeIn,
    Layout,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';

// --- FIREBASE IMPORTS ---
import { addDoc, collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import CakeCanvas3D, { type TopDesign } from '../components/CakeCanvas3D';
import { auth, db } from '../firebaseConfig';

const MIN_DATE = new Date();
MIN_DATE.setDate(MIN_DATE.getDate() + 7);
const DRAFT_STORAGE_KEY = 'custom-cake-design-draft';
const DRAFTS_STORAGE_KEY = 'custom-cake-design-drafts';

const COATING_OPTIONS = ['Buttercream', 'Fondant', 'Ganache', 'Naked', 'Custom coating'];
const FLAVOR_OPTIONS = ['Vanilla', 'Chocolate', 'Red Velvet', 'Lemon', 'Carrot', 'Custom flavor'];
const FILLING_OPTIONS = ['Vanilla Cream', 'Chocolate Mousse', 'Berry Compote', 'Salted Caramel', 'Custom filling'];
const TOPPING_OPTIONS = ['strawberries', 'flowers', 'gold leaf', 'oreo', 'Custom topping'];
const AGE_RESTRICTED_SHAPE = '18+ adult-themed (age verified)';
const SHAPE_OPTIONS = ['Round', 'Square', 'Hexagonal', 'Heart', 'Star', 'Custom shape', AGE_RESTRICTED_SHAPE];
const PRODUCT_TYPES = ['Cake', 'Cupcake'] as const;
type CupcakeFlavorDetail = {
    filling: string;
    customFilling: string;
    standardToppings: string[];
    customToppings: string[];
    referenceImages: string[];
    facePrintImages: string[];
};
type CakeTier = {
    width: number;
    height: number;
    shape: string;
    flavors: string[];
    notes: string;
};
type SavedAiCupcakeDesign = {
    id: string;
    imageUri: string;
    quantity: number;
    notes: string;
    referenceImages: string[];
    facePrintImage: string | null;
};
const AI_STYLE_OPTIONS = ['Elegant', 'Rustic', 'Modern', 'Gothic', 'Luxury', 'Custom style'];
const AI_CAKE_TEXT_OPTIONS = ['No text', 'Happy Birthday', 'Happy Anniversary', 'Congratulations', 'Custom text'];
const AI_TEXT_COLOR_OPTIONS = ['Gold', 'White', 'Black', 'Red', 'Pink', 'Blue', 'Custom color'];
const COATING_COLORS: Record<string, string> = {
    'Buttercream': '#FFF8D9',
    'Fondant': '#F8E7EA',
    'Ganache': '#E4D5CE',
    'Naked': '#E8D2C0',
};
const FLAVOR_COLORS: Record<string, string> = {
    Vanilla: '#FFF4D6',
    Chocolate: '#6B4030',
    'Red Velvet': '#9E3036',
    Lemon: '#F5E38A',
    Carrot: '#D9823B',
};

const PROMPT_TIPS = [
    "Tip: Mention specific flowers like 'sunflowers', 'peonies', or 'dried lavender'.",
    "Tip: Use texture words like 'concrete finish', 'torn paper edges', or 'watercolor brushstrokes'.",
    "Tip: Describe colors exactly, e.g., 'terracotta, champagne gold, and emerald green'.",
    "Tip: Mention the vibe, like 'art deco luxury', 'rustic woodland', or 'sleek futuristic'."
];

const HF_API_KEY = "CONFIGURE_HUGGING_FACE_TOKEN_ON_SERVER";
const HF_URL = "https://router.huggingface.co/nscale/v1/images/generations";

const fetchWithNetworkFallback = async (options: RequestInit) => {
    try {
        return await fetch(HF_URL, options);
    } catch (firstError) {
        try {
            return await fetch(HF_URL, options);
        } catch {
            throw new Error(
                `Unable to reach Hugging Face. Check your internet connection or DNS settings. ${
                    firstError instanceof Error ? firstError.message : ''
                }`.trim()
            );
        }
    }
};

export default function CustomCakeScreen() {
    const router = useRouter();
    const scrollRef = useRef<ScrollView>(null);
    const promptRef = useRef<TextInput>(null);
    const supportRoomRef = useRef<string | null>(null);
    const [openingSupport, setOpeningSupport] = useState(false);
    const [previewCupcakeFlavor, setPreviewCupcakeFlavor] = useState('Vanilla');
    const [showReview, setShowReview] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const { width, height } = useWindowDimensions();
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false); 
    const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');
    const [productType, setProductType] = useState<typeof PRODUCT_TYPES[number]>('Cake');
    const [tipIndex, setTipIndex] = useState(0);
    
    // AI STATES
    const [aiPrompt, setAiPrompt] = useState(''); 
    const [aiGeneratedImage, setAiGeneratedImage] = useState<string | null>(null);
    const [aiStyle, setAiStyle] = useState('Elegant');
    const [aiCustomStyle, setAiCustomStyle] = useState('');
    const [savedAiCupcakeDesigns, setSavedAiCupcakeDesigns] = useState<SavedAiCupcakeDesign[]>([]);
    const [showAiAccuracyNotice, setShowAiAccuracyNotice] = useState(true);
    const [showPreviewNotice, setShowPreviewNotice] = useState(false);

    // --- ANIMATION VALUES ---
    const pulseAnim = useSharedValue(1);
    const scrollOffset = useSharedValue(0);
    const hasGeneratedPreview = activeTab === 'ai' && !!aiGeneratedImage;
    const hasStickyPreview = hasGeneratedPreview || activeTab === 'manual';
    const previewHeight = activeTab === 'ai' && aiGeneratedImage
        ? Math.min(width, height * 0.48, 420)
        : Math.min(200, height * 0.3);
    const compactPreviewHeight = Math.min(150, height * 0.22, previewHeight);
    const handleScroll = useAnimatedScrollHandler((event) => {
        scrollOffset.value = Math.max(0, event.contentOffset.y);
    });
    const collapsingPreviewStyle = useAnimatedStyle(() => ({
        height: hasStickyPreview
            ? keyboardVisible
                ? compactPreviewHeight
                : Math.max(compactPreviewHeight, previewHeight - scrollOffset.value)
            : previewHeight,
    }));
    const previewNoticeStyle = useAnimatedStyle(() => ({
        opacity: hasStickyPreview
            ? keyboardVisible ? 0 : Math.max(0, 1 - scrollOffset.value / 60)
            : 1,
    }));

    // Tip Cycling Effect
    useEffect(() => {
        const interval = setInterval(() => {
            setTipIndex((prev) => (prev + 1) % PROMPT_TIPS.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // Keep a dismissal control available for every input, including multiline fields.
    useEffect(() => {
        const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => { show.remove(); hide.remove(); };
    }, []);

    useEffect(() => {
        if (!aiGeneratedImage || activeTab !== 'ai') return;
        Keyboard.dismiss();
        const frame = requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
        return () => cancelAnimationFrame(frame);
    }, [aiGeneratedImage, activeTab]);

    // Baking Pulse Effect
    useEffect(() => {
        if (generating) {
            pulseAnim.value = withRepeat(
                withSequence(withTiming(0.4, { duration: 800 }), withTiming(1, { duration: 800 })),
                -1,
                true
            );
        } else {
            pulseAnim.value = withTiming(1);
        }
    }, [generating]);

    useEffect(() => {
        const timeout = setTimeout(() => setShowAiAccuracyNotice(false), 7000);
        return () => clearTimeout(timeout);
    }, []);

    useEffect(() => {
        if (!showPreviewNotice) return;
        const timeout = setTimeout(() => setShowPreviewNotice(false), 6000);
        return () => clearTimeout(timeout);
    }, [showPreviewNotice]);

    const animatedPulseStyle = useAnimatedStyle(() => ({
        opacity: pulseAnim.value,
        transform: [{ scale: pulseAnim.value }]
    }));

    // SELECTIONS STATE
    const [selections, setSelections] = useState({
        coating: 'Buttercream',
        topDesign: { style: 'Swirls', coverage: 'Full top' } as TopDesign,
        cupcakeTopDesign: { style: 'Swirls', coverage: 'Full top' } as TopDesign,
        tiers: '1',
        flavors: ['Vanilla'] as string[],
        filling: 'Vanilla Cream',
        shape: 'Round',
        customFlavors: [] as string[],
        customCoating: '',
        customShape: '',
        customFilling: '',
        customToppings: [''] as string[],
        cupcakeQuantity: '6',
        cupcakeFlavorQuantities: {} as Record<string, number>,
        cupcakeFlavorDetails: {} as Record<string, CupcakeFlavorDetail>,
        toppings: [] as string[],
        flowerDetails: '',
        instructions: '',
        date: MIN_DATE, 
        referenceImages: [] as string[]
    });
    const cupcakeFlavors = Object.keys(selections.cupcakeFlavorQuantities);
    const visibleCupcakeFlavor = cupcakeFlavors.includes(previewCupcakeFlavor)
        ? previewCupcakeFlavor : cupcakeFlavors[0] || 'Vanilla';
    type DesignDraft = {
        id: string;
        savedAt: string;
        selections: typeof selections;
        cakeTiers: CakeTier[];
        customCakeTexts: string[];
        productType: typeof PRODUCT_TYPES[number];
        activeTab: 'manual' | 'ai';
        aiPrompt: string;
        aiStyle: string;
        aiCustomStyle: string;
        aiGeneratedImage?: string | null;
        savedAiCupcakeDesigns?: SavedAiCupcakeDesign[];
    };
    const [cakeTiers, setCakeTiers] = useState<CakeTier[]>([
        { width: 1, height: 0.42, shape: 'Round', flavors: ['Vanilla'], notes: '' },
    ]);
    const [customCakeTexts, setCustomCakeTexts] = useState<string[]>(['']);
    
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [savedDrafts, setSavedDrafts] = useState<DesignDraft[]>([]);
    const [showDrafts, setShowDrafts] = useState(false);

    useEffect(() => {
        const restoreDraft = async () => {
            try {
                const storedDrafts = await AsyncStorage.getItem(DRAFTS_STORAGE_KEY);
                const legacyDraft = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);
                const drafts = storedDrafts
                    ? JSON.parse(storedDrafts) as DesignDraft[]
                    : legacyDraft
                        ? [{ id: 'legacy-draft', ...JSON.parse(legacyDraft) as Omit<DesignDraft, 'id'> }]
                        : [];
                if (drafts.length === 0) return;
                setSavedDrafts(drafts);
                const draft = drafts[0];
                setSelections({ ...draft.selections, date: new Date(draft.selections.date) });
                setCakeTiers(draft.cakeTiers);
                setCustomCakeTexts(draft.customCakeTexts);
                setProductType(draft.productType);
                setActiveTab(draft.activeTab);
                setAiPrompt(draft.aiPrompt);
                setAiStyle(draft.aiStyle);
                setAiCustomStyle(draft.aiCustomStyle);
                setAiGeneratedImage(draft.aiGeneratedImage ?? null);
                setSavedAiCupcakeDesigns(draft.savedAiCupcakeDesigns ?? []);
            } catch (error) {
                console.error('Draft restore error:', error);
                Alert.alert('Draft unavailable', 'The saved design could not be restored.');
            }
        };
        restoreDraft();
    }, []);

    const saveDraft = async () => {
        if (savingDraft) return;
        Keyboard.dismiss();
        setSavingDraft(true);
        const savedAt = new Date().toISOString();
        const draft: DesignDraft = {
            id: `${Date.now()}`,
            selections,
            cakeTiers,
            customCakeTexts,
            productType,
            activeTab,
            aiPrompt,
            aiStyle,
            aiCustomStyle,
            savedAt,
            aiGeneratedImage,
            savedAiCupcakeDesigns,
        };
        try {
            if (!FileSystem.documentDirectory) throw new Error('Persistent storage unavailable');
            const directory = `${FileSystem.documentDirectory}cake-drafts/`;
            await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
            const copies = new Map<string, string>();
            // Preserve generated images, references and face prints outside the cache.
            const persistImages = async (value: unknown): Promise<unknown> => {
                if (typeof value === 'string' && /^(file|content):\/\//.test(value)) {
                    if (value.startsWith(directory)) return value;
                    const existing = copies.get(value);
                    if (existing) return existing;
                    const extension = value.split('?')[0].match(/\.(png|jpe?g|webp|heic)$/i)?.[0] ?? '.jpg';
                    const destination = `${directory}${draft.id}-${copies.size}${extension}`;
                    copies.set(value, destination);
                    await FileSystem.copyAsync({ from: value, to: destination });
                    return destination;
                }
                if (Array.isArray(value)) {
                    const result = [];
                    for (const item of value) result.push(await persistImages(item));
                    return result;
                }
                if (value && typeof value === 'object') {
                    const result: Record<string, unknown> = {};
                    for (const [key, item] of Object.entries(value)) result[key] = await persistImages(item);
                    return result;
                }
                return value;
            };
            const persistentDraft = await persistImages(JSON.parse(JSON.stringify(draft))) as DesignDraft;
            const updatedDrafts = [persistentDraft, ...savedDrafts].slice(0, 10);
            await AsyncStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(updatedDrafts));
            await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
            setSavedDrafts(updatedDrafts);
            Alert.alert('Draft saved', 'Your cake design was added to your saved drafts.');
        } catch (error) {
            console.error('Draft save error:', error);
            Alert.alert('Could not save draft', 'Please try again.');
        } finally {
            setSavingDraft(false);
        }
    };

    const loadDraft = (draft: DesignDraft) => {
        setSelections({ ...draft.selections, date: new Date(draft.selections.date) });
        setCakeTiers(draft.cakeTiers);
        setCustomCakeTexts(draft.customCakeTexts);
        setProductType(draft.productType);
        setActiveTab(draft.activeTab);
        setAiPrompt(draft.aiPrompt);
        setAiStyle(draft.aiStyle);
        setAiCustomStyle(draft.aiCustomStyle);
        setAiGeneratedImage(draft.aiGeneratedImage ?? null);
        setSavedAiCupcakeDesigns(draft.savedAiCupcakeDesigns ?? []);
        setShowDrafts(false);
    };

    const openDesignSupport = async () => {
        const user = auth.currentUser;
        if (!user || openingSupport) return;
        Keyboard.dismiss();
        setOpeningSupport(true);
        try {
            const roomId = supportRoomRef.current ?? doc(collection(db, 'support_chats')).id;
            supportRoomRef.current = roomId;
            const localImages = activeTab === 'ai'
                ? [aiGeneratedImage, ...savedAiCupcakeDesigns.map((design) => design.imageUri)].filter((uri): uri is string => !!uri)
                : selections.referenceImages;
            const images = await Promise.all([...localImages, ...(topDesign.coverage === 'Border / picture space' && topDesign.photoUri ? [topDesign.photoUri] : [])].map(async (uri, index) => {
                if (uri.startsWith('https://')) return uri;
                const response = await fetch(uri);
                const blob = await response.blob();
                const imageRef = ref(getStorage(), `support_designs/${user.uid}/${roomId}/${Date.now()}-${index}`);
                await uploadBytes(imageRef, blob);
                return getDownloadURL(imageRef);
            }));
            const summary = `${productType} request · ${activeTab === 'ai' ? 'AI design' : 'Manual design'}\n${getOrderSummary()}\n${images.length ? 'Design images attached.' : 'No design image yet — help with the cake request.'}`;
            const batch = writeBatch(db);
            batch.set(doc(db, 'support_chats', roomId), {
                id: roomId, roomId, userId: user.uid, userName: user.email || 'Customer',
                source: 'custom_design', orderName: `Custom ${productType.toLowerCase()} request`,
                eventDate: selections.date.toDateString(), imageUrl: images[0] || '', images,
                designSummary: summary, adminMessage: summary,
                designDetails: JSON.parse(JSON.stringify({ productType, activeTab, selections: { ...selections, referenceImages: [] }, cakeTiers, customCakeTexts, aiPrompt, aiStyle, aiCustomStyle })),
                lastMessage: 'Custom design shared for help', updatedAt: serverTimestamp(),
                status: 'active', unreadAdmin: true,
            }, { merge: true });
            await batch.commit();
            router.push({ pathname: '/chat', params: { roomId } });
        } catch {
            Alert.alert('Could not open design chat', 'Your design is still here. Please try again.');
        } finally {
            setOpeningSupport(false);
        }
    };

    const getServingGuidance = (tier: CakeTier) => {
        const diameterCm = Math.round(tier.width * 10);
        const servings = Math.max(4, Math.round((diameterCm / 10) ** 2 * 6));
        return `About ${Math.max(4, servings - 2)}-${servings + 2} servings`;
    };

    const topDesignKey = productType === 'Cupcake' ? 'cupcakeTopDesign' : 'topDesign';
    const topDesign = selections[topDesignKey] ?? { style: 'Swirls', coverage: 'Full top' };
    const updateTopDesign = (change: Partial<TopDesign>) => updateSelection(topDesignKey, { ...topDesign, ...change });
    const pickCentrePhoto = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
            if (!result.canceled) updateTopDesign({ photoUri: result.assets[0].uri, coverage: 'Border / picture space' });
        } catch {
            Alert.alert('Photo unavailable', 'Please try selecting the photo again.');
        }
    };
    const getOrderSummary = () => `${getBaseOrderSummary()}\nTop icing: ${topDesign.style}\nIcing coverage: ${topDesign.coverage}`;
    const getBaseOrderSummary = () => {
        if (activeTab === 'ai' && productType === 'Cake') {
            return `AI cake design\nYour vision: ${aiPrompt}\nStyle: ${aiStyle === 'Custom style' ? aiCustomStyle : aiStyle}\nPickup: ${selections.date.toDateString()}\nNotes: ${selections.instructions.trim() || 'None'}`;
        }
        if (productType === 'Cupcake') {
            const quantity = activeTab === 'ai'
                ? getSavedAiDesignQuantity()
                : Object.values(selections.cupcakeFlavorQuantities).reduce((sum, count) => sum + count, 0);
            return `${quantity} cupcakes\nFlavours: ${activeTab === 'ai' ? 'AI package designs' : Object.keys(selections.cupcakeFlavorQuantities).join(', ') || 'Not selected'}\nToppings: ${activeTab === 'ai' ? 'As shown in saved designs' : 'Per flavour selections'}\nPickup: ${selections.date.toDateString()}\nNotes: ${selections.instructions.trim() || 'None'}`;
        }
        const tiers = cakeTiers.map((tier, index) => `Tier ${index + 1}: ${Math.round(tier.width * 10)} cm, ${getServingGuidance(tier)}`).join('\n');
        return `${selections.tiers} tier${cakeTiers.length === 1 ? '' : 's'}\n${tiers}\nFlavours: ${cakeTiers.flatMap((tier) => tier.flavors).join(', ') || 'Not selected'}\nCoating: ${selections.coating === 'Custom coating' ? selections.customCoating || 'Custom' : selections.coating}\nFilling: ${selections.filling === 'Custom filling' ? selections.customFilling || 'Custom' : selections.filling}\nToppings: ${selections.toppings.join(', ') || 'None'}\nText: ${customCakeTexts.filter((text) => text.trim()).join(' / ') || 'None'}\nPickup: ${selections.date.toDateString()}\nNotes: ${selections.instructions.trim() || 'None'}`;
    };

    const updateCakeTier = (index: number, update: Partial<CakeTier>) => {
        setCakeTiers((current) => current.map((tier, tierIndex) => tierIndex === index ? { ...tier, ...update } : tier));
    };

    const toggleCakeTierFlavor = (tierIndex: number, flavor: string) => {
        setCakeTiers((current) => current.map((tier, index) => {
            if (index !== tierIndex) return tier;
            const flavors = tier.flavors.includes(flavor)
                ? tier.flavors.filter((item) => item !== flavor)
                : tier.flavors.length < 2 ? [...tier.flavors, flavor] : tier.flavors;
            return { ...tier, flavors };
        }));
    };

    const addCakeTier = () => {
        setCakeTiers((current) => [...current, { width: 0.82, height: 0.42, shape: 'Round', flavors: ['Vanilla'], notes: '' }]);
        setCustomCakeTexts((current) => [...current, '']);
    };

    const removeCakeTier = () => {
        setCakeTiers((current) => {
            if (current.length <= 1) return current;
            setCustomCakeTexts((texts) => texts.slice(0, current.length - 1));
            return current.slice(0, -1);
        });
    };

    const updateCustomCakeText = (tierIndex: number, value: string) => {
        setCustomCakeTexts((current) => current.map((text, index) => index === tierIndex ? value : text));
    };

    const saveAiCupcakeDesign = () => {
        if (!aiGeneratedImage) {
            Alert.alert('Generate a design first', 'Create an AI design before saving it to your cupcake package.');
            return;
        }
        setSavedAiCupcakeDesigns((current) => [
            ...current,
            {
                id: `${Date.now()}`,
                imageUri: aiGeneratedImage,
                quantity: 6,
                notes: aiPrompt,
                referenceImages: [],
                facePrintImage: null,
            },
        ]);
        setAiGeneratedImage(null);
        setAiPrompt('');
        Alert.alert('Design saved', 'The design was added to your cupcake package. You can create another design.');
    };

    const updateSavedAiDesign = (id: string, update: Partial<SavedAiCupcakeDesign>) => {
        setSavedAiCupcakeDesigns((current) => current.map((design) => design.id === id ? { ...design, ...update } : design));
    };

    const removeSavedAiDesign = (id: string) => {
        setSavedAiCupcakeDesigns((current) => current.filter((design) => design.id !== id));
    };

    const pickSavedAiDesignImage = async (id: string, field: 'referenceImages' | 'facePrintImage') => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (result.canceled) return;
        const uri = result.assets[0].uri;
        setSavedAiCupcakeDesigns((current) => current.map((design) => design.id === id
            ? { ...design, [field]: field === 'referenceImages' ? [...design.referenceImages, uri] : uri }
            : design));
    };

    const getSavedAiDesignQuantity = () => savedAiCupcakeDesigns.reduce((total, design) => total + design.quantity, 0);

    const updateSelection = (key: string, value: any) => {
        setSelections(prev => ({ ...prev, [key]: value }));
    };

    const toggleTopping = (topping: string) => {
        setSelections((prev) => ({
            ...prev,
            toppings: prev.toppings.includes(topping)
                ? prev.toppings.filter((item) => item !== topping)
                : [...prev.toppings, topping],
        }));
    };

    const toggleFlavor = (flavor: string) => {
        setSelections((prev) => ({
            ...prev,
            flavors: prev.flavors.includes(flavor)
                ? prev.flavors.filter((item) => item !== flavor)
                : [...prev.flavors, flavor],
        }));
    };

    const updateCustomFlavor = (index: number, value: string) => {
        setSelections((prev) => {
            const customFlavors = [...prev.customFlavors];
            customFlavors[index] = value;
            return { ...prev, customFlavors };
        });
    };

    const addCustomFlavor = () => {
        setSelections((prev) => ({ ...prev, customFlavors: [...prev.customFlavors, ''] }));
    };

    const updateCustomTopping = (index: number, value: string) => {
        setSelections((prev) => {
            const customToppings = [...prev.customToppings];
            customToppings[index] = value;
            return { ...prev, customToppings };
        });
    };

    const addCustomTopping = () => {
        setSelections((prev) => ({ ...prev, customToppings: [...prev.customToppings, ''] }));
    };

    const adjustTiers = (amount: number) => {
        const currentTiers = Math.max(1, Number.parseInt(selections.tiers, 10) || 1);
        updateSelection('tiers', String(Math.max(1, currentTiers + amount)));
    };

    const adjustCupcakeFlavor = (flavor: string, amount: number) => {
        setSelections((prev) => {
            const current = prev.cupcakeFlavorQuantities[flavor] || 0;
            const next = Math.max(0, current + amount);
            const cupcakeFlavorQuantities = { ...prev.cupcakeFlavorQuantities };
            if (next === 0) {
                delete cupcakeFlavorQuantities[flavor];
            } else {
                cupcakeFlavorQuantities[flavor] = next;
            }
            const total = Object.values(cupcakeFlavorQuantities).reduce((sum, quantity) => sum + quantity, 0);
            const detail = prev.cupcakeFlavorDetails[flavor];
            const cupcakeFlavorDetails = detail
                ? {
                    ...prev.cupcakeFlavorDetails,
                    [flavor]: {
                        ...detail,
                        facePrintImages: detail.facePrintImages.slice(0, next),
                    },
                }
                : prev.cupcakeFlavorDetails;
            return {
                ...prev,
                cupcakeFlavorQuantities,
                cupcakeFlavorDetails,
                cupcakeQuantity: String(Math.max(6, total)),
            };
        });
    };

    const updateCupcakeFlavorDetail = (flavor: string, key: 'filling' | 'customFilling', value: string) => {
        setSelections((prev) => ({
            ...prev,
            cupcakeFlavorDetails: {
                ...prev.cupcakeFlavorDetails,
                [flavor]: {
                    ...(prev.cupcakeFlavorDetails[flavor] || { filling: 'Vanilla Cream', customFilling: '', standardToppings: [], customToppings: [''], referenceImages: [], facePrintImages: [] }),
                    [key]: value,
                },
            },
        }));
    };

    const toggleCupcakeFlavorTopping = (flavor: string, topping: string) => {
        setSelections((prev) => {
            const detail = prev.cupcakeFlavorDetails[flavor] || { filling: 'Vanilla Cream', customFilling: '', standardToppings: [], customToppings: [''], referenceImages: [], facePrintImages: [] };
            const standardToppings = detail.standardToppings.includes(topping)
                ? detail.standardToppings.filter((item) => item !== topping)
                : [...detail.standardToppings, topping];
            return {
                ...prev,
                cupcakeFlavorDetails: { ...prev.cupcakeFlavorDetails, [flavor]: { ...detail, standardToppings } },
            };
        });
    };

    const updateCupcakeFlavorTopping = (flavor: string, index: number, value: string) => {
        setSelections((prev) => {
            const detail = prev.cupcakeFlavorDetails[flavor] || { filling: 'Vanilla Cream', customFilling: '', standardToppings: [], customToppings: [''], referenceImages: [], facePrintImages: [] };
            const customToppings = [...detail.customToppings];
            customToppings[index] = value;
            return {
                ...prev,
                cupcakeFlavorDetails: { ...prev.cupcakeFlavorDetails, [flavor]: { ...detail, customToppings } },
            };
        });
    };

    const addCupcakeFlavorTopping = (flavor: string) => {
        setSelections((prev) => {
            const detail = prev.cupcakeFlavorDetails[flavor] || { filling: 'Vanilla Cream', customFilling: '', standardToppings: [], customToppings: [], referenceImages: [], facePrintImages: [] };
            return {
                ...prev,
                cupcakeFlavorDetails: {
                    ...prev.cupcakeFlavorDetails,
                    [flavor]: { ...detail, customToppings: [...detail.customToppings, ''] },
                },
            };
        });
    };

    const pickCupcakeFlavorReference = async (flavor: string) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.6,
        });
        if (!result.canceled) {
            setSelections((prev) => {
                const detail = prev.cupcakeFlavorDetails[flavor] || { filling: 'Vanilla Cream', customFilling: '', standardToppings: [], customToppings: [''], referenceImages: [], facePrintImages: [] };
                return {
                    ...prev,
                    cupcakeFlavorDetails: {
                        ...prev.cupcakeFlavorDetails,
                        [flavor]: { ...detail, referenceImages: [...detail.referenceImages, result.assets[0].uri] },
                    },
                };
            });
        }
    };

    const pickCupcakeFacePrint = async (flavor: string) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled) {
            setSelections((prev) => {
                const detail = prev.cupcakeFlavorDetails[flavor] || { filling: 'Vanilla Cream', customFilling: '', standardToppings: [], customToppings: [''], referenceImages: [], facePrintImages: [] };
                return {
                    ...prev,
                    cupcakeFlavorDetails: {
                        ...prev.cupcakeFlavorDetails,
                        [flavor]: { ...detail, facePrintImages: [...detail.facePrintImages, result.assets[0].uri] },
                    },
                };
            });
        }
    };

    const fillCupcakeFacePrints = (flavor: string) => {
        setSelections((prev) => {
            const detail = prev.cupcakeFlavorDetails[flavor];
            if (!detail?.facePrintImages.length) return prev;
            const quantity = prev.cupcakeFlavorQuantities[flavor] || 0;
            const images = Array.from({ length: quantity }, (_, index) => detail.facePrintImages[index % detail.facePrintImages.length]);
            return {
                ...prev,
                cupcakeFlavorDetails: {
                    ...prev.cupcakeFlavorDetails,
                    [flavor]: { ...detail, facePrintImages: images },
                },
            };
        });
    };

    const copyCupcakeFacePrints = (sourceFlavor: string, targetFlavor: string) => {
        setSelections((prev) => {
            const source = prev.cupcakeFlavorDetails[sourceFlavor];
            const target = prev.cupcakeFlavorDetails[targetFlavor];
            if (!source?.facePrintImages.length || !target) return prev;
            const quantity = prev.cupcakeFlavorQuantities[targetFlavor] || 0;
            const images = Array.from({ length: quantity }, (_, index) => source.facePrintImages[index % source.facePrintImages.length]);
            return {
                ...prev,
                cupcakeFlavorDetails: {
                    ...prev.cupcakeFlavorDetails,
                    [targetFlavor]: { ...target, facePrintImages: images },
                },
            };
        });
    };

    const addCustomCupcakeFlavor = () => {
        const flavor = `Custom flavor ${selections.customFlavors.length + 1}`;
        setSelections((prev) => ({
            ...prev,
            customFlavors: [...prev.customFlavors, flavor],
            cupcakeFlavorQuantities: { ...prev.cupcakeFlavorQuantities, [flavor]: 1 },
            cupcakeFlavorDetails: {
                ...prev.cupcakeFlavorDetails,
                [flavor]: { filling: 'Vanilla Cream', customFilling: '', standardToppings: [], customToppings: [''], referenceImages: [], facePrintImages: [] },
            },
        }));
    };

    const renameCustomCupcakeFlavor = (currentName: string, nextName: string) => {
        const normalizedName = nextName.trim() || currentName;
        if (normalizedName === currentName || selections.cupcakeFlavorQuantities[normalizedName]) return;
        setSelections((prev) => {
            const cupcakeFlavorQuantities = { ...prev.cupcakeFlavorQuantities, [normalizedName]: prev.cupcakeFlavorQuantities[currentName] };
            const cupcakeFlavorDetails = { ...prev.cupcakeFlavorDetails, [normalizedName]: prev.cupcakeFlavorDetails[currentName] };
            delete cupcakeFlavorQuantities[currentName];
            delete cupcakeFlavorDetails[currentName];
            return {
                ...prev,
                customFlavors: prev.customFlavors.map((flavor) => flavor === currentName ? normalizedName : flavor),
                cupcakeFlavorQuantities,
                cupcakeFlavorDetails,
            };
        });
    };

    const handleGenerateAI = async () => {
        if (aiPrompt.length < 10) {
            Alert.alert("More Detail Needed", "Tell the AI about your theme, colors, and specific decorations.");
            return;
        }
        if (aiStyle === 'Custom style' && !aiCustomStyle.trim()) {
            Alert.alert("Add Style", "Describe the custom cake style.");
            return;
        }
        Keyboard.dismiss();
        setGenerating(true);

        try {
            const selectedStyle = aiStyle === 'Custom style' ? aiCustomStyle : aiStyle;
            const productPrompt = productType === 'Cupcake'
                ? 'premium cupcake design concept for a saved package; focus on the overall decoration and styling'
                : 'premium custom cake design concept; focus on the overall decoration and styling';
            const formattedPrompt = `Professional high-end custom ${productType.toLowerCase()} design, ${aiPrompt}, ${productPrompt}, ${selectedStyle} style, 8k photo, bokeh background, dramatic studio bakery lighting`;

            const response = await fetchWithNetworkFallback({
                    headers: {
                        Authorization: `Bearer ${HF_API_KEY}`,
                        "Content-Type": "application/json",
                    },
                    method: "POST",
                    body: JSON.stringify({
                        model: "black-forest-labs/FLUX.1-schnell",
                        prompt: formattedPrompt,
                        response_format: "b64_json",
                    }),
                });

            if (response.status === 503) {
                Alert.alert(
                    "AI Warming Up",
                    "The FLUX model is loading on Hugging Face servers. Please try generating again in 10-15 seconds."
                );
                return;
            }

            if (!response.ok) {
                const errorBody = await response.text();
                let errorMessage = errorBody;
                try {
                    const parsedError = JSON.parse(errorBody) as { error?: string };
                    errorMessage = parsedError.error || errorBody;
                } catch {
                    // Keep the raw response when Hugging Face does not return JSON.
                }
                throw new Error(
                    `Generation failed with status ${response.status}: ${
                        errorMessage || "Hugging Face returned no details"
                    }`
                );
            }

            const result = await response.json() as {
                data?: Array<{ b64_json?: string }>;
            };
            const base64Data = result.data?.[0]?.b64_json;
            if (!base64Data) {
                throw new Error("Hugging Face returned no generated image.");
            }

            // Save binary stream as local JPEG file
            const fileUri = `${FileSystem.cacheDirectory}flux_cake_${Date.now()}.jpg`;
            await FileSystem.writeAsStringAsync(fileUri, base64Data, {
                encoding: FileSystem.EncodingType.Base64,
            });

            setAiGeneratedImage(fileUri);
            setShowAiAccuracyNotice(true);
            setTimeout(() => setShowAiAccuracyNotice(false), 7000);
        } catch (error: any) {
            console.error("Hugging Face Generation Error:", error);
            Alert.alert("Generation Failed", error.message || "Could not generate cake concept.");
        } finally {
            setGenerating(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.6,
        });
        if (!result.canceled) {
            updateSelection('referenceImages', [...selections.referenceImages, result.assets[0].uri]);
        }
    };

    // --- UPLOAD LOGIC ---
    const handleSaveOrder = async (skipReview = false) => {
        if (loading || generating) return;
        Keyboard.dismiss();
        if (activeTab === 'ai' && productType === 'Cake' && !aiGeneratedImage) {
            Alert.alert('Generate a design first', 'Create a cake image before requesting a quote.');
            return;
        }
        const user = auth.currentUser;
        if (!user) return Alert.alert("Error", "Please sign in.");

        if (selections.date.getTime() < MIN_DATE.getTime()) {
            Alert.alert("Choose a later date", "Please select a pickup date at least 7 days from today.");
            return;
        }

        if (productType === 'Cupcake' && activeTab === 'manual') {
            const cupcakeTotal = Object.values(selections.cupcakeFlavorQuantities).reduce((sum, quantity) => sum + quantity, 0);
            if (cupcakeTotal < 6) {
                Alert.alert("Choose cupcakes", "Please select at least 6 cupcakes across one or more flavours.");
                return;
            }
            const missingFacePrints = Object.entries(selections.cupcakeFlavorQuantities)
                .filter(([flavor, quantity]) => (selections.cupcakeFlavorDetails[flavor]?.facePrintImages.length || 0) < quantity)
                .map(([flavor]) => flavor);
            if (missingFacePrints.length > 0) {
                Alert.alert(
                    "Add face prints",
                    `Please add or reuse a face image for every cupcake in: ${missingFacePrints.join(', ')}.`
                );
                return;
            }
        }
        if (productType === 'Cupcake' && activeTab === 'ai' && getSavedAiDesignQuantity() < 6) {
            Alert.alert("Save cupcake designs", "Please save at least one AI cupcake design with a total package quantity of 6 or more.");
            return;
        }

        if (!skipReview) {
            setShowReview(true);
            return;
        }
        setShowReview(false);
        
        setLoading(true);
        try {
            let finalImageUrl = null;
            let finalImagesArray: string[] = [];
            const cupcakeFlavorReferenceImages: Record<string, string[]> = {};
            const cupcakeFlavorFacePrintImages: Record<string, string[]> = {};
            const selectedManualFlavors = [
                ...selections.flavors.filter((flavor) => flavor !== 'Custom flavor'),
                ...selections.customFlavors.filter((flavor) => flavor.trim()),
            ];
            const selectedCupcakeFlavors = Object.entries(selections.cupcakeFlavorQuantities)
                .map(([flavor, quantity]) => `${flavor} (${quantity})`);
            const selectedManualShape = selections.shape === 'Custom shape'
                ? selections.customShape
                : selections.shape === AGE_RESTRICTED_SHAPE
                    ? `${AGE_RESTRICTED_SHAPE}: ${selections.customShape}`
                    : selections.shape;
            const selectedManualFilling = selections.filling === 'Custom filling' ? selections.customFilling : selections.filling;
            const selectedManualCoating = selections.coating === 'Custom coating' ? selections.customCoating : selections.coating;

            const storage = getStorage();

            let uploadedAiCupcakeDesigns: Array<Record<string, unknown>> = [];
            if (activeTab === 'ai') {
                if (aiGeneratedImage) {
                    // Upload generated FLUX local cached file to Firebase Storage
                    const response = await fetch(aiGeneratedImage);
                    const blob = await response.blob();
                    const storageRef = ref(storage, `customer_orders/${user.uid}/${Date.now()}_flux.jpg`);
                    
                    await uploadBytes(storageRef, blob);
                    finalImageUrl = await getDownloadURL(storageRef);
                    finalImagesArray = [finalImageUrl];
                }
                if (productType === 'Cupcake') {
                    uploadedAiCupcakeDesigns = await Promise.all(savedAiCupcakeDesigns.map(async (design, designIndex) => {
                        const designResponse = await fetch(design.imageUri);
                        const designBlob = await designResponse.blob();
                        const designRef = ref(storage, `customer_orders/${user.uid}/${Date.now()}_ai-design-${designIndex}.jpg`);
                        await uploadBytes(designRef, designBlob);
                        const imageUrl = await getDownloadURL(designRef);
                        const referenceUrls = await Promise.all(design.referenceImages.map(async (localUri, referenceIndex) => {
                            const response = await fetch(localUri);
                            const blob = await response.blob();
                            const imageRef = ref(storage, `customer_orders/${user.uid}/${Date.now()}_ai-design-${designIndex}-reference-${referenceIndex}.jpg`);
                            await uploadBytes(imageRef, blob);
                            return getDownloadURL(imageRef);
                        }));
                        let facePrintUrl = null;
                        if (design.facePrintImage) {
                            const response = await fetch(design.facePrintImage);
                            const blob = await response.blob();
                            const faceRef = ref(storage, `customer_orders/${user.uid}/${Date.now()}_ai-design-${designIndex}-face.jpg`);
                            await uploadBytes(faceRef, blob);
                            facePrintUrl = await getDownloadURL(faceRef);
                        }
                        return { imageUrl, quantity: design.quantity, notes: design.notes, referenceImages: referenceUrls, facePrintImage: facePrintUrl };
                    }));
                }
            } else {
                // Manual images uploaded to Firebase Storage
                const uploadPromises = selections.referenceImages.map(async (localUri, index) => {
                    const response = await fetch(localUri);
                    const blob = await response.blob();
                    
                    const storageRef = ref(storage, `customer_orders/${user.uid}/${Date.now()}_${index}.jpg`);
                    await uploadBytes(storageRef, blob);
                    
                    return await getDownloadURL(storageRef);
                });

                finalImagesArray = await Promise.all(uploadPromises);
                finalImageUrl = finalImagesArray.length > 0 ? finalImagesArray[0] : null;
            }

            if (productType === 'Cupcake') {
                for (const flavor of Object.keys(selections.cupcakeFlavorQuantities)) {
                    const detail = selections.cupcakeFlavorDetails[flavor];
                    if (!detail) continue;
                    const uploadedReferences = await Promise.all(detail.referenceImages.map(async (localUri, index) => {
                        const response = await fetch(localUri);
                        const blob = await response.blob();
                        const storageRef = ref(storage, `customer_orders/${user.uid}/${Date.now()}_${flavor.replace(/\s+/g, '-')}_${index}.jpg`);
                        await uploadBytes(storageRef, blob);
                        return getDownloadURL(storageRef);
                    }));
                    if (uploadedReferences.length > 0) {
                        cupcakeFlavorReferenceImages[flavor] = uploadedReferences;
                    }
                    const uploadedFacePrints = await Promise.all(detail.facePrintImages.map(async (localUri, index) => {
                        const response = await fetch(localUri);
                        const blob = await response.blob();
                        const storageRef = ref(storage, `customer_orders/${user.uid}/${Date.now()}_${flavor.replace(/\s+/g, '-')}_face-${index}.jpg`);
                        await uploadBytes(storageRef, blob);
                        return getDownloadURL(storageRef);
                    }));
                    if (uploadedFacePrints.length > 0) {
                        cupcakeFlavorFacePrintImages[flavor] = uploadedFacePrints;
                    }
                }
            }

            let centrePhotoUrl: string | null = null;
            if (topDesign.coverage === 'Border / picture space' && topDesign.photoUri) {
                const response = await fetch(topDesign.photoUri);
                const photoRef = ref(getStorage(), `customer_orders/${user.uid}/${Date.now()}_centre-photo.jpg`);
                await uploadBytes(photoRef, await response.blob());
                centrePhotoUrl = await getDownloadURL(photoRef);
                finalImagesArray.push(centrePhotoUrl);
            }
            const orderData = {
                topDesign: { ...topDesign, photoUri: centrePhotoUrl },
                centrePhotoUrl,
                userId: user.uid,
                userEmail: user.email,
                fullName: user.displayName || "Valued Customer",
                designMethod: activeTab,
                productType,
                quantity: productType === 'Cupcake'
                    ? activeTab === 'ai'
                        ? Math.max(6, getSavedAiDesignQuantity())
                        : Math.max(6, Number.parseInt(selections.cupcakeQuantity, 10) || 6)
                    : 1,
                name: activeTab === 'ai' ? "AI Concept Request" : "Custom Build Request",
                
                imageUrl: finalImageUrl, 
                images: finalImagesArray, 
                
                cakeType: productType === 'Cupcake'
                    ? 'Cupcake package'
                    : activeTab === 'manual'
                        ? `${selections.tiers} Tiers - ${selectedManualShape} - ${selectedManualCoating}`
                        : "AI Style Interpretation",
                flavor: activeTab === 'manual'
                    ? (productType === 'Cupcake' ? selectedCupcakeFlavors.join(', ') : cakeTiers.flatMap((tier) => tier.flavors).join(', '))
                    : undefined,
                filling: activeTab === 'manual' ? selectedManualFilling : undefined,
                toppings: activeTab === 'manual'
                    ? [
                        ...selections.toppings.filter((topping) => topping !== 'Custom topping' && topping !== 'flowers'),
                        ...(selections.toppings.includes('flowers')
                            ? [`flowers${selections.flowerDetails.trim() ? `: ${selections.flowerDetails.trim()}` : ''}`]
                            : []),
                        ...selections.customToppings.filter((topping) => topping.trim()),
                    ]
                    : undefined,
                flavors: activeTab === 'manual'
                    ? productType === 'Cupcake' ? Object.keys(selections.cupcakeFlavorQuantities) : cakeTiers.flatMap((tier) => tier.flavors)
                    : undefined,
                cakeTiers: productType === 'Cake' && activeTab === 'manual' ? cakeTiers : undefined,
                cupcakeFlavorBreakdown: productType === 'Cupcake' ? selections.cupcakeFlavorQuantities : undefined,
                cupcakeFlavorDetails: productType === 'Cupcake' ? selections.cupcakeFlavorDetails : undefined,
                cupcakeFlavorReferenceImages: productType === 'Cupcake' ? cupcakeFlavorReferenceImages : undefined,
                cupcakeFlavorFacePrintImages: productType === 'Cupcake' ? cupcakeFlavorFacePrintImages : undefined,
                aiCupcakeDesigns: productType === 'Cupcake' && activeTab === 'ai' ? uploadedAiCupcakeDesigns : undefined,
                customNotes: activeTab === 'ai'
                    ? `PROMPT: ${aiPrompt}\nPRODUCT: ${productType}\nSTYLE: ${aiStyle === 'Custom style' ? aiCustomStyle : aiStyle}\n\nADDITIONAL: ${selections.instructions}`
                    : `SHAPE: ${selectedManualShape}\n${customCakeTexts.map((text, index) => text.trim() ? `CUSTOM TEXT (TIER ${index + 1}): ${text.trim()}` : '').filter(Boolean).join('\n')}${selections.instructions ? `\n${selections.instructions}` : ''}`,
                eventDate: selections.date.toDateString(),
                timestamp: serverTimestamp(),
                status: 'awaiting_admin',
                adminApproved: false,
                price: 0, 
            };

            // Firestore rejects undefined values; omit fields that do not apply to this design.
            const quoteData = Object.fromEntries(
                Object.entries(orderData).filter(([, value]) => value !== undefined)
            );
            await addDoc(collection(db, "customer_orders"), quoteData);

            Alert.alert(
                "Design Submitted!", 
                "Our bakers have received your design. Check your 'My Orders' section soon for your price quote!",
                [{ text: "OK", onPress: () => router.replace('/(tabs)') }]
            );

        } catch (error: any) {
            console.error("Save Error:", error);
            Alert.alert("Upload Failed", "Could not upload images. Please check your internet connection.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.navigationBar}>
                    <TouchableOpacity style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back" onPress={() => { Keyboard.dismiss(); router.back(); }}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.navigationTitle}>Custom design</Text>
                </View>
                <Animated.ScrollView
                    ref={scrollRef}
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                    nestedScrollEnabled
                    contentContainerStyle={styles.scrollContent}
                    stickyHeaderIndices={hasStickyPreview ? [0] : undefined}
                    removeClippedSubviews={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                >
                {/* Reserve the expanded height so shrinking never shifts the scroll offset. */}
                <View style={{ height: previewHeight }} pointerEvents="box-none">
                <Animated.View style={[styles.previewSection, collapsingPreviewStyle]}>
                    {aiGeneratedImage && activeTab === 'ai' ? (
                        <Animated.Image
                            entering={FadeIn.duration(800)}
                            source={{ uri: aiGeneratedImage }}
                            style={styles.headerImage}
                            resizeMode="contain"
                        />
                    ) : activeTab === 'manual' ? (
                        <View style={styles.canvasContainer}>
                            <CakeCanvas3D
                                topDesign={topDesign}
                                cupcake={productType === 'Cupcake' ? {
                                    flavor: visibleCupcakeFlavor,
                                    color: FLAVOR_COLORS[visibleCupcakeFlavor] || '#FFF4D6',
                                    toppings: selections.cupcakeFlavorDetails[visibleCupcakeFlavor]?.standardToppings || [],
                                } : undefined}
                                tiers={cakeTiers.map((tier) => ({
                                    width: tier.width,
                                    height: tier.height,
                                    shape: tier.shape === AGE_RESTRICTED_SHAPE ? 'Custom shape' : tier.shape,
                                    flavorColors: tier.flavors.map((flavor) => FLAVOR_COLORS[flavor] || '#FFF4D6'),
                                }))}
                                coating={selections.coating}
                                coatingColor={COATING_COLORS[selections.coating] || '#FFFDD0'}
                                toppings={selections.toppings}
                                customTexts={customCakeTexts}
                            />
                        </View>
                    ) : (
                        <Animated.View style={[styles.cakeStage, animatedPulseStyle]}>
                            <Ionicons name={generating ? "restaurant" : productType === 'Cupcake' ? "ice-cream" : "sparkles"} size={50} color="#FFD700" />
                            <Text style={styles.placeholderText}>
                                {generating ? "FLUX IS BAKING..." : productType === 'Cupcake' ? "CUPCAKE DESIGN STUDIO" : "AI DESIGN STUDIO"}
                            </Text>
                        </Animated.View>
                    )}
                    {activeTab === 'manual' && productType === 'Cake' && (
                        <TouchableOpacity
                            accessibilityLabel="Show 3D preview information"
                            style={styles.previewInfoButton}
                            onPress={() => setShowPreviewNotice(true)}
                        >
                            <Ionicons name="information-circle-outline" size={22} color="#FFD700" />
                        </TouchableOpacity>
                    )}
                    {showPreviewNotice && activeTab === 'manual' && productType === 'Cake' && (
                        <Animated.View entering={FadeIn} style={styles.previewNotice}>
                            <Ionicons name="information-circle-outline" size={18} color="#FFD700" />
                            <Text style={styles.aiAccuracyNoticeText}>
                                This 3D model is a visual preview of your selections. The final cake may look different and is confirmed by the bakery before submission.
                            </Text>
                        </Animated.View>
                    )}
                    {activeTab === 'ai' && showAiAccuracyNotice && (
                        <Animated.View pointerEvents="none" entering={FadeIn} style={[styles.aiAccuracyNotice, previewNoticeStyle]}>
                            <Ionicons name="information-circle-outline" size={18} color="#FFD700" />
                            <Text style={styles.aiAccuracyNoticeText}>AI designs are creative suggestions and may not always be accurate. Review and refine each design before saving it.</Text>
                        </Animated.View>
                    )}
                </Animated.View>
                </View>
                    {activeTab === 'manual' && productType === 'Cupcake' && (
                        <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
                            <Text style={styles.servingHint}>Preview: {visibleCupcakeFlavor} cupcake · frosting and decorations are illustrative</Text>
                            {cupcakeFlavors.length > 1 && <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false}>
                                {cupcakeFlavors.map((flavor) => <TouchableOpacity key={flavor} style={[styles.chip, flavor === visibleCupcakeFlavor && styles.activeChip]} onPress={() => setPreviewCupcakeFlavor(flavor)}><Text style={[styles.chipText, flavor === visibleCupcakeFlavor && styles.activeChipText]}>{flavor}</Text></TouchableOpacity>)}
                            </ScrollView>}
                        </View>
                    )}
                    <View style={styles.productTypeContainer}>
                        {PRODUCT_TYPES.map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[styles.productTypeTab, productType === type && styles.activeProductTypeTab]}
                                onPress={() => setProductType(type)}
                            >
                                <Text style={[styles.productTypeText, productType === type && styles.activeProductTypeText]}>
                                    {type}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <View style={styles.tabContainer}>
                        <TouchableOpacity 
                            style={[styles.tab, activeTab === 'manual' && styles.activeTab]} 
                            onPress={() => setActiveTab('manual')}
                        >
                            <Text style={[styles.tabText, activeTab === 'manual' && styles.activeTabText]}>Manual</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.tab, activeTab === 'ai' && styles.activeTab]} 
                            onPress={() => setActiveTab('ai')}
                        >
                            <Text style={[styles.tabText, activeTab === 'ai' && styles.activeTabText]}>AI Design</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.supportBtn}
                        disabled={openingSupport}
                        onPress={() => { void openDesignSupport(); }}
                        accessibilityRole="button"
                        accessibilityLabel="Get help choosing a cake design"
                    >
                        <Ionicons name="chatbubble-ellipses-outline" size={20} color="#FFD700" />
                        <View style={styles.supportTextWrap}>
                            <Text style={styles.supportTitle}>{openingSupport ? 'Sharing your design…' : 'Need help choosing?'}</Text>
                            <Text style={styles.supportSubtitle}>Chat with our team about flavors, sizes, and design.</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#666" />
                    </TouchableOpacity>
                    <View style={styles.draftActions}>
                        <TouchableOpacity style={styles.saveDraftButton} disabled={savingDraft} onPress={() => { void saveDraft(); }}>
                            <Ionicons name="save-outline" size={17} color="#FFD700" />
                            <Text style={styles.draftButtonText}>{savingDraft ? 'Saving…' : 'Save draft'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.viewDraftsButton}
                            onPress={() => setShowDrafts(true)}
                            accessibilityRole="button"
                            accessibilityLabel="View saved drafts"
                        >
                            <Ionicons name="folder-open-outline" size={17} color="#fff" />
                            <Text style={styles.viewDraftsButtonText}>View saved drafts</Text>
                            <View style={styles.draftCountBadge}>
                                <Text style={styles.draftCountText}>{savedDrafts.length}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.controls}>
                        {activeTab === 'ai' ? (
                            <Animated.View entering={FadeIn} layout={Layout.springify()}>
                                <View style={styles.tipBox}>
                                    <Text style={styles.tipText}>{PROMPT_TIPS[tipIndex]}</Text>
                                </View>
                                {productType === 'Cupcake' && (
                                    <>
                                        <Text style={styles.sectionTitle}>Saved cupcake package</Text>
                                        <Text style={styles.quantitySummary}>{getSavedAiDesignQuantity()} Cupcakes total across {savedAiCupcakeDesigns.length} saved designs</Text>
                                        <Text style={styles.imageHint}>Generate a design, save it, choose its quantity, then create another design for the same package.</Text>
                                    </>
                                )}
                                <Text style={styles.sectionTitle}>Your Vision</Text>
                                <TextInput
                                    ref={promptRef}
                                    style={styles.inputField}
                                    placeholder={productType === 'Cupcake'
                                        ? 'E.g. pastel cupcakes with floral edible prints...'
                                        : 'E.g. 3-tier marble cake with gold leaf...'}
                                    placeholderTextColor="#555"
                                    multiline
                                    value={aiPrompt}
                                    onChangeText={setAiPrompt}
                                />
                                <Text style={styles.sectionTitle}>Design style</Text>
                                <View style={styles.chipRow}>
                                    {AI_STYLE_OPTIONS.map((option) => (
                                        <TouchableOpacity key={option} style={[styles.chip, aiStyle === option && styles.activeChip]} onPress={() => setAiStyle(option)}>
                                            <Text style={[styles.chipText, aiStyle === option && styles.activeChipText]}>{option}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {aiStyle === 'Custom style' && (
                                    <TextInput
                                        style={styles.inputField}
                                        placeholder="Describe your custom style..."
                                        placeholderTextColor="#555"
                                        value={aiCustomStyle}
                                        onChangeText={setAiCustomStyle}
                                    />
                                )}
                                {productType === 'Cupcake' && (
                                    <>
                                        <Text style={styles.sectionTitle}>Saved designs</Text>
                                        {savedAiCupcakeDesigns.map((design, index) => (
                                            <View key={design.id} style={styles.flavorPackageCard}>
                                                <Image source={{ uri: design.imageUri }} style={styles.savedDesignImage} />
                                                <Text style={styles.flavorPortionText}>Design {index + 1}</Text>
                                                <View style={styles.flavorPortionControls}>
                                                    <TouchableOpacity style={styles.smallTierButton} onPress={() => updateSavedAiDesign(design.id, { quantity: Math.max(1, design.quantity - 1) })}><Text style={styles.tierButtonText}>−</Text></TouchableOpacity>
                                                    <Text style={styles.flavorPortionText}>{design.quantity} cupcakes</Text>
                                                    <TouchableOpacity style={styles.smallTierButton} onPress={() => updateSavedAiDesign(design.id, { quantity: design.quantity + 1 })}><Text style={styles.tierButtonText}>+</Text></TouchableOpacity>
                                                </View>
                                                <TextInput style={styles.inputField} placeholder="Notes for this design..." placeholderTextColor="#555" multiline value={design.notes} onChangeText={(notes) => updateSavedAiDesign(design.id, { notes })} />
                                                <View style={styles.chipRow}>
                                                    <TouchableOpacity style={styles.chip} onPress={() => pickSavedAiDesignImage(design.id, 'referenceImages')}><Text style={styles.chipText}>Add reference</Text></TouchableOpacity>
                                                    <TouchableOpacity style={styles.chip} onPress={() => pickSavedAiDesignImage(design.id, 'facePrintImage')}><Text style={styles.chipText}>Add face paint</Text></TouchableOpacity>
                                                    <TouchableOpacity style={styles.chip} onPress={() => { setAiPrompt(`${design.notes}\nPlease refine this saved design.`); setAiGeneratedImage(design.imageUri); }}><Text style={styles.chipText}>Tweak design</Text></TouchableOpacity>
                                                    <TouchableOpacity style={styles.chip} onPress={() => removeSavedAiDesign(design.id)}><Text style={styles.chipText}>Discard</Text></TouchableOpacity>
                                                </View>
                                                {design.referenceImages.map((uri) => <Image key={uri} source={{ uri }} style={styles.refImage} />)}
                                                {design.facePrintImage && <Image source={{ uri: design.facePrintImage }} style={styles.refImage} />}
                                            </View>
                                        ))}
                                    </>
                                )}
                                {false ? (
                                    <>
                                        <Text style={styles.imageHint}>Choose any quantity for each flavor. You can combine flavors in one package.</Text>
                                        <View style={styles.chipRow}>
                                            {FLAVOR_OPTIONS.filter((option) => option !== 'Custom flavor').map((option) => (
                                                <TouchableOpacity key={option} style={styles.chip} onPress={() => adjustCupcakeFlavor(option, 1)}>
                                                    <Text style={styles.chipText}>+ {option}</Text>
                                                </TouchableOpacity>
                                            ))}
                                            <TouchableOpacity style={styles.chip} onPress={addCustomCupcakeFlavor}>
                                                <Text style={styles.chipText}>+ Custom flavor</Text>
                                            </TouchableOpacity>
                                        </View>
                                        {Object.entries(selections.cupcakeFlavorQuantities).map(([flavor, quantity]) => (
                                            <View key={flavor} style={styles.flavorPackageCard}>
                                                {flavor.startsWith('Custom flavor') && (
                                                    <TextInput
                                                        style={styles.inputField}
                                                        placeholder="Name this custom flavor..."
                                                        placeholderTextColor="#555"
                                                        defaultValue={flavor}
                                                        onEndEditing={(event) => renameCustomCupcakeFlavor(flavor, event.nativeEvent.text)}
                                                    />
                                                )}
                                                <Text style={styles.flavorPortionText}>{flavor}: {quantity}</Text>
                                                <View style={styles.flavorPortionControls}>
                                                    <TouchableOpacity style={styles.smallTierButton} onPress={() => adjustCupcakeFlavor(flavor, -1)}>
                                                        <Text style={styles.tierButtonText}>−</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={styles.smallTierButton} onPress={() => adjustCupcakeFlavor(flavor, 1)}>
                                                        <Text style={styles.tierButtonText}>+</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                <Text style={styles.flavorDetailLabel}>Filling for {flavor}</Text>
                                                <View style={styles.chipRow}>
                                                    {FILLING_OPTIONS.map((option) => (
                                                        <TouchableOpacity key={option} style={[styles.chip, selections.cupcakeFlavorDetails[flavor]?.filling === option && styles.activeChip]} onPress={() => updateCupcakeFlavorDetail(flavor, 'filling', option)}>
                                                            <Text style={[styles.chipText, selections.cupcakeFlavorDetails[flavor]?.filling === option && styles.activeChipText]}>{option}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                                {selections.cupcakeFlavorDetails[flavor]?.filling === 'Custom filling' && (
                                                    <TextInput style={styles.inputField} placeholder="Describe this filling..." placeholderTextColor="#555" value={selections.cupcakeFlavorDetails[flavor]?.customFilling || ''} onChangeText={(value) => updateCupcakeFlavorDetail(flavor, 'customFilling', value)} />
                                                )}
                                                <Text style={styles.flavorDetailLabel}>Toppings for {flavor}</Text>
                                                <View style={styles.chipRow}>
                                                    {TOPPING_OPTIONS.map((option) => (
                                                        <TouchableOpacity
                                                            key={`${flavor}-${option}`}
                                                            style={[styles.chip, selections.cupcakeFlavorDetails[flavor]?.standardToppings.includes(option) && styles.activeChip]}
                                                            onPress={() => toggleCupcakeFlavorTopping(flavor, option)}
                                                        >
                                                            <Text style={[styles.chipText, selections.cupcakeFlavorDetails[flavor]?.standardToppings.includes(option) && styles.activeChipText]}>
                                                                {option}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                                {selections.cupcakeFlavorDetails[flavor]?.standardToppings.includes('Custom topping') && (
                                                    <>
                                                        <Text style={styles.flavorDetailLabel}>Custom toppings for {flavor}</Text>
                                                        {(selections.cupcakeFlavorDetails[flavor]?.customToppings || ['']).map((topping, index) => (
                                                            <TextInput key={`${flavor}-topping-${index}`} style={styles.inputField} placeholder="Custom topping..." placeholderTextColor="#555" value={topping} onChangeText={(value) => updateCupcakeFlavorTopping(flavor, index, value)} />
                                                        ))}
                                                        <TouchableOpacity style={styles.addOptionButton} onPress={() => addCupcakeFlavorTopping(flavor)}><Text style={styles.addOptionText}>+ Add topping</Text></TouchableOpacity>
                                                    </>
                                                )}
                                                <Text style={styles.flavorDetailLabel}>Face prints for {flavor} ({selections.cupcakeFlavorDetails[flavor]?.facePrintImages.length || 0}/{quantity})</Text>
                                                <Text style={styles.imageHint}>Add one face image per cupcake, or upload one and reuse it for all {flavor} cupcakes.</Text>
                                                <TouchableOpacity style={styles.chip} onPress={() => pickCupcakeFacePrint(flavor)}><Text style={styles.chipText}>Add face print image</Text></TouchableOpacity>
                                                {!!selections.cupcakeFlavorDetails[flavor]?.facePrintImages.length && <TouchableOpacity style={styles.addOptionButton} onPress={() => fillCupcakeFacePrints(flavor)}><Text style={styles.addOptionText}>Use the latest image for all {flavor} cupcakes</Text></TouchableOpacity>}
                                                {(Object.keys(selections.cupcakeFlavorQuantities).filter((otherFlavor) => otherFlavor !== flavor && selections.cupcakeFlavorDetails[otherFlavor]?.facePrintImages.length > 0)).map((otherFlavor) => (
                                                    <TouchableOpacity key={`${flavor}-copy-face-${otherFlavor}`} style={styles.addOptionButton} onPress={() => copyCupcakeFacePrints(otherFlavor, flavor)}>
                                                        <Text style={styles.addOptionText}>Use face images from {otherFlavor}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                                {(selections.cupcakeFlavorDetails[flavor]?.facePrintImages || []).map((uri, index) => <Image key={`${flavor}-face-print-${index}`} source={{ uri }} style={styles.refImage} />)}
                                                <Text style={styles.flavorDetailLabel}>Reference image for {flavor}</Text>
                                                <Text style={styles.imageHint}>Add a photo showing how you want this flavour's cupcakes to look.</Text>
                                                <TouchableOpacity style={styles.chip} onPress={() => pickCupcakeFlavorReference(flavor)}><Text style={styles.chipText}>Add reference image</Text></TouchableOpacity>
                                                {(selections.cupcakeFlavorDetails[flavor]?.referenceImages || []).map((uri, index) => <Image key={`${flavor}-reference-${index}`} source={{ uri }} style={styles.refImage} />)}
                                            </View>
                                        ))}
                                    </>
                                ) : null}
                                <TouchableOpacity style={styles.generateBtn} onPress={handleGenerateAI} disabled={generating}>
                                    {generating ? <ActivityIndicator color="#000" /> : <Text style={styles.generateBtnText}>{aiGeneratedImage ? 'GENERATE NEW VERSION' : 'GENERATE IMAGE'}</Text>}
                                </TouchableOpacity>
                                {aiGeneratedImage && (
                                    <View style={styles.chipRow}>
                                        <TouchableOpacity style={styles.chip} disabled={generating} onPress={() => {
                                            Keyboard.dismiss();
                                            if (productType === 'Cupcake') saveAiCupcakeDesign();
                                            else scrollRef.current?.scrollToEnd({ animated: true });
                                        }}><Text style={styles.draftButtonText}>Use this design</Text></TouchableOpacity>
                                        <TouchableOpacity style={styles.chip} disabled={generating} onPress={() => promptRef.current?.focus()}><Text style={styles.draftButtonText}>Refine design</Text></TouchableOpacity>
                                    </View>
                                )}
                                {aiGeneratedImage && <Text style={styles.aiNote}>Refine your description, then generate a new version. The current image stays visible until the new one is ready.</Text>}
                                <Text style={styles.aiNote}>* Powered by FLUX.1. Our bakers will use this image as a visual guide.</Text>
                            </Animated.View>
                        ) : (
                            <Animated.View entering={FadeIn} layout={Layout.springify()}>
                                {productType === 'Cupcake' && (
                                    <>
                                        <Text style={styles.sectionTitle}>Cupcake quantity</Text>
                                        <Text style={styles.quantitySummary}>{selections.cupcakeQuantity} Cupcakes total — adjust each flavor below</Text>
                                    </>
                                )}
                                {productType === 'Cake' && (
                                    <>
                                        <Text style={styles.sectionTitle}>Reference Images</Text>
                                        <Text style={styles.imageHint}>Add photos to show our bakers what you have in mind.</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                                            <TouchableOpacity style={styles.addImgBtn} onPress={pickImage}>
                                                <View style={styles.addImgIcon}>
                                                    <Ionicons name="camera" size={22} color="#000" />
                                                </View>
                                                <Text style={styles.addImgText}>Add photo</Text>
                                            </TouchableOpacity>
                                            {selections.referenceImages.map((uri, index) => (
                                                <View key={index} style={styles.imageWrapper}>
                                                    <Image source={{ uri }} style={styles.refImage} />
                                                </View>
                                            ))}
                                        </ScrollView>
                                    </>
                                )}

                                {productType === 'Cake' && (<>
                                <Text style={styles.sectionTitle}>Cake tiers</Text>
                                {cakeTiers.map((tier, tierIndex) => (
                                    <View key={`cake-tier-${tierIndex}`} style={styles.flavorPackageCard}>
                                        <Text style={styles.flavorPortionText}>Tier {tierIndex + 1}</Text>
                                        <Text style={styles.servingHint}>{getServingGuidance(tier)} based on this tier&apos;s size</Text>
                                        <Text style={styles.flavorDetailLabel}>Tier width: {Math.round(tier.width * 10)} cm</Text>
                                        <Slider
                                            minimumValue={0.7}
                                            maximumValue={1.5}
                                            step={0.05}
                                            value={tier.width}
                                            minimumTrackTintColor="#FFD700"
                                            maximumTrackTintColor="#555"
                                            thumbTintColor="#FFD700"
                                            onValueChange={(width) => updateCakeTier(tierIndex, { width })}
                                        />
                                        <Text style={styles.flavorDetailLabel}>Tier height: {Math.round(tier.height * 10)} cm</Text>
                                        <Slider
                                            minimumValue={0.28}
                                            maximumValue={0.8}
                                            step={0.02}
                                            value={tier.height}
                                            minimumTrackTintColor="#FFD700"
                                            maximumTrackTintColor="#555"
                                            thumbTintColor="#FFD700"
                                            onValueChange={(height) => updateCakeTier(tierIndex, { height })}
                                        />
                                        <Text style={styles.flavorDetailLabel}>Tier shape</Text>
                                        <View style={styles.chipRow}>
                                            {SHAPE_OPTIONS.filter((shape) =>
                                                shape !== AGE_RESTRICTED_SHAPE
                                                || tier.shape === 'Custom shape'
                                                || tier.shape === AGE_RESTRICTED_SHAPE
                                            ).map((shape) => (
                                                <TouchableOpacity key={shape} style={[styles.chip, tier.shape === shape && styles.activeChip]} onPress={() => updateCakeTier(tierIndex, { shape })}>
                                                    <Text style={[styles.chipText, tier.shape === shape && styles.activeChipText]}>{shape}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                        {(tier.shape === 'Custom shape' || tier.shape === AGE_RESTRICTED_SHAPE) && (
                                            <>
                                                <Text style={styles.flavorDetailLabel}>
                                                    {tier.shape === AGE_RESTRICTED_SHAPE ? 'Adult-themed design notes' : 'Custom shape notes'}
                                                </Text>
                                                <TextInput
                                                    style={styles.inputField}
                                                    placeholder={tier.shape === AGE_RESTRICTED_SHAPE
                                                        ? 'Describe the adult-themed design and boundaries...'
                                                        : 'Describe your custom cake shape...'}
                                                    placeholderTextColor="#555"
                                                    value={tier.notes}
                                                    onChangeText={(notes) => updateCakeTier(tierIndex, { notes })}
                                                    multiline
                                                />
                                            </>
                                        )}
                                        <Text style={styles.flavorDetailLabel}>Notes for tier {tierIndex + 1}</Text>
                                        <TextInput
                                            style={styles.inputField}
                                            placeholder="Add instructions for this tier..."
                                            placeholderTextColor="#555"
                                            value={tier.notes}
                                            onChangeText={(notes) => updateCakeTier(tierIndex, { notes })}
                                            multiline
                                        />
                                    </View>
                                ))}
                                <View style={styles.chipRow}>
                                    <TouchableOpacity style={styles.chip} onPress={addCakeTier}><Text style={styles.chipText}>+ Add tier</Text></TouchableOpacity>
                                    <TouchableOpacity style={styles.chip} onPress={removeCakeTier}><Text style={styles.chipText}>− Remove top tier</Text></TouchableOpacity>
                                </View>
                                <Text style={styles.sectionTitle}>Custom text request</Text>
                                {cakeTiers.map((_, tierIndex) => (
                                    <TextInput
                                        key={`custom-text-tier-${tierIndex}`}
                                        style={styles.inputField}
                                        placeholder={`Word or message for tier ${tierIndex + 1}...`}
                                        placeholderTextColor="#555"
                                        value={customCakeTexts[tierIndex] || ''}
                                        onChangeText={(value) => updateCustomCakeText(tierIndex, value)}
                                    />
                                ))}

                                <Text style={styles.sectionTitle}>{productType} coating</Text>
                                <View style={styles.chipRow}>
                                    {COATING_OPTIONS.map(opt => (
                                        <TouchableOpacity 
                                            key={opt} 
                                            style={[styles.chip, selections.coating === opt && styles.activeChip]} 
                                            onPress={() => updateSelection('coating', opt)}
                                        >
                                            <Text style={[styles.chipText, selections.coating === opt && styles.activeChipText]}>{opt}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {selections.coating === 'Custom coating' && (
                                    <TextInput
                                        style={styles.inputField}
                                        placeholder="Describe your custom coating..."
                                        placeholderTextColor="#555"
                                        value={selections.customCoating}
                                        onChangeText={(value) => updateSelection('customCoating', value)}
                                    />
                                )}
                                </>)}
                                {productType === 'Cake' && (<>
                                <Text style={styles.sectionTitle}>Toppings</Text>
                                <View style={styles.toppingsChipRow}>
                                    {TOPPING_OPTIONS.map((topping) => (
                                        <TouchableOpacity
                                            key={topping}
                                            style={[styles.chip, styles.toppingChip, selections.toppings.includes(topping) && styles.activeChip]}
                                            onPress={() => toggleTopping(topping)}
                                        >
                                            <Text style={[styles.chipText, selections.toppings.includes(topping) && styles.activeChipText]}>
                                                {topping}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {selections.toppings.includes('Custom topping') && (
                                    <View>
                                        {selections.customToppings.map((topping, index) => (
                                            <TextInput
                                                key={`custom-topping-${index}`}
                                                style={styles.inputField}
                                                placeholder={`Custom topping ${index + 1}...`}
                                                placeholderTextColor="#555"
                                                value={topping}
                                                onChangeText={(value) => updateCustomTopping(index, value)}
                                            />
                                        ))}
                                        <TouchableOpacity style={styles.addOptionButton} onPress={addCustomTopping}>
                                            <Text style={styles.addOptionText}>+ Add another custom topping</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                {selections.toppings.includes('flowers') && (
                                    <TextInput
                                        style={styles.inputField}
                                        placeholder="Specify the flowers you want (for example, roses, peonies, or sunflowers)..."
                                        placeholderTextColor="#555"
                                        value={selections.flowerDetails}
                                        onChangeText={(value) => updateSelection('flowerDetails', value)}
                                        multiline
                                    />
                                )}
                                </>)}
                                {productType === 'Cupcake' ? (
                                    <>
                                        <Text style={styles.sectionTitle}>Flavor</Text>
                                        <Text style={styles.imageHint}>Choose any quantity for each flavor. You can combine flavors in one package.</Text>
                                        <View style={styles.chipRow}>
                                            {FLAVOR_OPTIONS.filter((option) => option !== 'Custom flavor').map((option) => (
                                                <TouchableOpacity key={option} style={styles.chip} onPress={() => adjustCupcakeFlavor(option, 1)}>
                                                    <Text style={styles.chipText}>+ {option}</Text>
                                                </TouchableOpacity>
                                            ))}
                                            <TouchableOpacity style={styles.chip} onPress={addCustomCupcakeFlavor}>
                                                <Text style={styles.chipText}>+ Custom flavor</Text>
                                            </TouchableOpacity>
                                        </View>
                                        {Object.entries(selections.cupcakeFlavorQuantities).map(([flavor, quantity]) => (
                                            <View key={flavor} style={styles.flavorPackageCard}>
                                                {flavor.startsWith('Custom flavor') && (
                                                    <TextInput
                                                        style={styles.inputField}
                                                        placeholder="Name this custom flavor..."
                                                        placeholderTextColor="#555"
                                                        defaultValue={flavor}
                                                        onEndEditing={(event) => renameCustomCupcakeFlavor(flavor, event.nativeEvent.text)}
                                                    />
                                                )}
                                                <Text style={styles.flavorPortionText}>{flavor}: {quantity}</Text>
                                                <View style={styles.flavorPortionControls}>
                                                    <TouchableOpacity style={styles.smallTierButton} onPress={() => adjustCupcakeFlavor(flavor, -1)}>
                                                        <Text style={styles.tierButtonText}>−</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={styles.smallTierButton} onPress={() => adjustCupcakeFlavor(flavor, 1)}>
                                                        <Text style={styles.tierButtonText}>+</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                <Text style={styles.flavorDetailLabel}>Filling for {flavor}</Text>
                                                <View style={styles.chipRow}>
                                                    {FILLING_OPTIONS.map((option) => (
                                                        <TouchableOpacity key={option} style={[styles.chip, selections.cupcakeFlavorDetails[flavor]?.filling === option && styles.activeChip]} onPress={() => updateCupcakeFlavorDetail(flavor, 'filling', option)}>
                                                            <Text style={[styles.chipText, selections.cupcakeFlavorDetails[flavor]?.filling === option && styles.activeChipText]}>{option}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                                {selections.cupcakeFlavorDetails[flavor]?.filling === 'Custom filling' && (
                                                    <TextInput style={styles.inputField} placeholder="Describe this filling..." placeholderTextColor="#555" value={selections.cupcakeFlavorDetails[flavor]?.customFilling || ''} onChangeText={(value) => updateCupcakeFlavorDetail(flavor, 'customFilling', value)} />
                                                )}
                                                <Text style={styles.flavorDetailLabel}>Toppings for {flavor}</Text>
                                                <View style={styles.chipRow}>
                                                    {TOPPING_OPTIONS.map((option) => (
                                                        <TouchableOpacity
                                                            key={`${flavor}-${option}`}
                                                            style={[styles.chip, selections.cupcakeFlavorDetails[flavor]?.standardToppings.includes(option) && styles.activeChip]}
                                                            onPress={() => toggleCupcakeFlavorTopping(flavor, option)}
                                                        >
                                                            <Text style={[styles.chipText, selections.cupcakeFlavorDetails[flavor]?.standardToppings.includes(option) && styles.activeChipText]}>
                                                                {option}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                                {selections.cupcakeFlavorDetails[flavor]?.standardToppings.includes('Custom topping') && (
                                                    <>
                                                        <Text style={styles.flavorDetailLabel}>Custom toppings for {flavor}</Text>
                                                        {(selections.cupcakeFlavorDetails[flavor]?.customToppings || ['']).map((topping, index) => (
                                                            <TextInput key={`${flavor}-topping-${index}`} style={styles.inputField} placeholder="Custom topping..." placeholderTextColor="#555" value={topping} onChangeText={(value) => updateCupcakeFlavorTopping(flavor, index, value)} />
                                                        ))}
                                                        <TouchableOpacity style={styles.addOptionButton} onPress={() => addCupcakeFlavorTopping(flavor)}><Text style={styles.addOptionText}>+ Add topping</Text></TouchableOpacity>
                                                    </>
                                                )}
                                                <Text style={styles.flavorDetailLabel}>Face prints for {flavor} ({selections.cupcakeFlavorDetails[flavor]?.facePrintImages.length || 0}/{quantity})</Text>
                                                <Text style={styles.imageHint}>Add one face image per cupcake, or upload one and reuse it for all {flavor} cupcakes.</Text>
                                                <TouchableOpacity style={styles.chip} onPress={() => pickCupcakeFacePrint(flavor)}><Text style={styles.chipText}>Add face print image</Text></TouchableOpacity>
                                                {!!selections.cupcakeFlavorDetails[flavor]?.facePrintImages.length && <TouchableOpacity style={styles.addOptionButton} onPress={() => fillCupcakeFacePrints(flavor)}><Text style={styles.addOptionText}>Use the latest image for all {flavor} cupcakes</Text></TouchableOpacity>}
                                                {(Object.keys(selections.cupcakeFlavorQuantities).filter((otherFlavor) => otherFlavor !== flavor && selections.cupcakeFlavorDetails[otherFlavor]?.facePrintImages.length > 0)).map((otherFlavor) => (
                                                    <TouchableOpacity key={`${flavor}-copy-face-${otherFlavor}`} style={styles.addOptionButton} onPress={() => copyCupcakeFacePrints(otherFlavor, flavor)}>
                                                        <Text style={styles.addOptionText}>Use face images from {otherFlavor}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                                {(selections.cupcakeFlavorDetails[flavor]?.facePrintImages || []).map((uri, index) => <Image key={`${flavor}-face-print-${index}`} source={{ uri }} style={styles.refImage} />)}
                                                <Text style={styles.flavorDetailLabel}>Reference image for {flavor}</Text>
                                                <Text style={styles.imageHint}>Add a photo showing how you want this flavour's cupcakes to look.</Text>
                                                <TouchableOpacity style={styles.chip} onPress={() => pickCupcakeFlavorReference(flavor)}><Text style={styles.chipText}>Add reference image</Text></TouchableOpacity>
                                                {(selections.cupcakeFlavorDetails[flavor]?.referenceImages || []).map((uri, index) => <Image key={`${flavor}-reference-${index}`} source={{ uri }} style={styles.refImage} />)}
                                            </View>
                                        ))}
                                    </>
                                ) : productType === 'Cake' ? (
                                    <Text style={styles.imageHint}>Flavours are selected inside each tier above (up to two per tier).</Text>
                                ) : null}
                                {productType === 'Cupcake' && <Text style={styles.imageHint}>Toppings and face prints are selected inside each flavor card above.</Text>}
                                {productType === 'Cake' && cakeTiers.some((tier) => tier.flavors.includes('Custom flavor')) && (
                                    <View>
                                        {selections.customFlavors.map((flavor, index) => (
                                            <TextInput
                                                key={`custom-flavor-${index}`}
                                                style={styles.inputField}
                                                placeholder={`Custom flavor ${index + 1}...`}
                                                placeholderTextColor="#555"
                                                value={flavor}
                                                onChangeText={(value) => updateCustomFlavor(index, value)}
                                            />
                                        ))}
                                        <TouchableOpacity style={styles.addOptionButton} onPress={addCustomFlavor}>
                                            <Text style={styles.addOptionText}>+ Add another custom flavor</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {productType === 'Cake' && (
                                    <>
                                        <Text style={styles.sectionTitle}>Filling</Text>
                                        <View style={styles.chipRow}>
                                            {FILLING_OPTIONS.map(opt => (
                                                <TouchableOpacity
                                                    key={opt}
                                                    style={[styles.chip, selections.filling === opt && styles.activeChip]}
                                                    onPress={() => updateSelection('filling', opt)}
                                                >
                                                    <Text style={[styles.chipText, selections.filling === opt && styles.activeChipText]}>{opt}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                        {selections.filling === 'Custom filling' && (
                                            <TextInput
                                                style={styles.inputField}
                                                placeholder="Describe your custom filling..."
                                                placeholderTextColor="#555"
                                                value={selections.customFilling}
                                                onChangeText={(value) => updateSelection('customFilling', value)}
                                            />
                                        )}
                                    </>
                                )}
                            </Animated.View>
                        )}

                        <Text style={styles.sectionTitle}>{productType === 'Cupcake' ? 'Cupcake icing design' : 'Cake top design'}</Text>
                        <Text style={styles.servingHint}>Choose the piping shape and how much of the top it covers. For cakes this applies to the highest tier; for cupcakes it applies to the package.</Text>
                        <Text style={styles.flavorDetailLabel}>Icing shape</Text>
                        <View style={styles.chipRow}>
                            {(['Dollops', 'Rosettes', 'Swirls'] as const).map((style) => <TouchableOpacity key={style} style={[styles.chip, topDesign.style === style && styles.activeChip]} onPress={() => updateTopDesign({ style })}><Text style={[styles.chipText, topDesign.style === style && styles.activeChipText]}>{productType === 'Cupcake' ? ({ Dollops: 'Piped dollops', Rosettes: 'Rose swirl', Swirls: 'Classic swirl' })[style] : style}</Text></TouchableOpacity>)}
                        </View>
                        <Text style={styles.flavorDetailLabel}>Icing coverage</Text>
                        <View style={styles.chipRow}>
                            {(['Full top', 'Border / picture space', 'Half top'] as const).map((coverage) => <TouchableOpacity key={coverage} style={[styles.chip, topDesign.coverage === coverage && styles.activeChip]} onPress={() => updateTopDesign({ coverage })}><Text style={[styles.chipText, topDesign.coverage === coverage && styles.activeChipText]}>{coverage}</Text></TouchableOpacity>)}
                        </View>
                        {topDesign.coverage === 'Border / picture space' && <View>
                            <Text style={styles.flavorDetailLabel}>Centre photo (optional)</Text>
                            <Text style={styles.servingHint}>Add a photo for an edible print, or leave the centre blank. The same photo applies to all cupcakes in this package.</Text>
                            {topDesign.photoUri && <Image source={{ uri: topDesign.photoUri }} style={styles.savedDesignImage} contentFit="contain" />}
                            <View style={styles.chipRow}>
                                <TouchableOpacity style={styles.chip} onPress={() => { void pickCentrePhoto(); }}><Text style={styles.draftButtonText}>{topDesign.photoUri ? 'Change photo' : 'Add centre photo'}</Text></TouchableOpacity>
                                {!!topDesign.photoUri && <TouchableOpacity style={styles.chip} onPress={() => updateTopDesign({ photoUri: null })}><Text style={styles.chipText}>Leave centre blank</Text></TouchableOpacity>}
                            </View>
                        </View>}
                        <Text style={styles.servingHint}>Coverage controls raised icing above the base finish. In AI mode these choices are instructions for the bakery and do not change an existing image.</Text>
                        <Text style={styles.sectionTitle}>Additional Notes</Text>
                        <Text style={styles.allergyNotice}>Please list allergies clearly. Our bakery will confirm ingredients and cross-contamination precautions before accepting the order.</Text>
                        <TextInput
                            style={styles.inputField}
                            placeholder="Allergies (for example: nuts, dairy), delivery notes, or anything else..."
                            placeholderTextColor="#555"
                            multiline
                            value={selections.instructions}
                            onChangeText={(t) => updateSelection('instructions', t)}
                        />

                        <Text style={styles.sectionTitle}>When do you need it?</Text>
                        <TouchableOpacity
                            style={styles.dateSelector}
                            onPress={() => { Keyboard.dismiss(); setShowDatePicker(true); }}
                            accessibilityRole="button"
                            accessibilityLabel={`Choose pickup date. Currently ${selections.date.toDateString()}`}
                        >
                            <View style={styles.dateIconCircle}>
                                <Ionicons name="calendar" size={22} color="#000" />
                            </View>
                            <View style={styles.dateTextWrap}>
                                <Text style={styles.dateLabel}>PICKUP DATE</Text>
                                <Text style={styles.dateText}>{selections.date.toDateString()}</Text>
                                <Text style={styles.dateHint}>Tap to choose a date at least 7 days ahead</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#FFD700" />
                        </TouchableOpacity>

                        <Text style={styles.aiNote}>Request a quote — no payment is taken now. The bakery will confirm availability and the final price before you pay.</Text>
                        <TouchableOpacity style={styles.confirmBtn} onPress={() => { void handleSaveOrder(); }} disabled={loading || generating}>
                            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.confirmBtnText}>Review Design</Text>}
                        </TouchableOpacity>
                    </View>
                </Animated.ScrollView>
                {keyboardVisible && (
                    <View style={styles.keyboardToolbar}>
                        <TouchableOpacity
                            style={styles.keyboardDoneButton}
                            onPress={Keyboard.dismiss}
                            accessibilityRole="button"
                            accessibilityLabel="Done editing, dismiss keyboard"
                        >
                            <Ionicons name="checkmark" size={20} color="#FFD700" />
                            <Text style={styles.draftButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>

            <Modal visible={showReview} transparent animationType="slide" onRequestClose={() => setShowReview(false)}>
                <View style={styles.draftsModalOverlay}>
                    <View style={styles.draftsModalCard}>
                        <Text style={styles.draftsModalTitle}>Review your design</Text>
                        <ScrollView style={styles.draftsList} contentContainerStyle={styles.draftsListContent}>
                            {activeTab === 'ai' && productType === 'Cake' && aiGeneratedImage && <Image source={{ uri: aiGeneratedImage }} style={styles.savedDesignImage} contentFit="contain" />}
                            {activeTab === 'manual' && selections.referenceImages.map((uri) => <Image key={uri} source={{ uri }} style={styles.savedDesignImage} contentFit="contain" />)}
                            {activeTab === 'ai' && productType === 'Cupcake' && savedAiCupcakeDesigns.map((design) => (
                                <View key={design.id}>
                                    <Image source={{ uri: design.imageUri }} style={styles.savedDesignImage} contentFit="contain" />
                                    <Text style={styles.servingHint}>{design.quantity} cupcakes · {design.notes}</Text>
                                </View>
                            ))}
                            {topDesign.coverage === 'Border / picture space' && topDesign.photoUri && <View><Text style={styles.servingHint}>Centre photo for edible printing</Text><Image source={{ uri: topDesign.photoUri }} style={styles.savedDesignImage} contentFit="contain" /></View>}
                            <Text style={{ color: '#fff', lineHeight: 24 }}>{getOrderSummary()}</Text>
                            <Text style={styles.servingHint}>The bakery will review your design and send a quote. No payment is taken now.</Text>
                        </ScrollView>
                        <View style={styles.dateModalActions}>
                            <TouchableOpacity style={styles.dateCancelButton} onPress={() => setShowReview(false)}><Text style={styles.dateCancelText}>Keep editing</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.dateDoneButton} disabled={loading} onPress={() => { void handleSaveOrder(true); }}><Text style={styles.dateDoneText}>Request quote</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showDrafts}
                transparent
                animationType="slide"
                onRequestClose={() => setShowDrafts(false)}
            >
                <View style={styles.draftsModalOverlay}>
                    <View style={styles.draftsModalCard}>
                        <View style={styles.draftsModalHeader}>
                            <View>
                                <Text style={styles.draftsModalTitle}>Saved drafts</Text>
                                <Text style={styles.draftsModalSubtitle}>Choose a design to continue editing</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowDrafts(false)} accessibilityLabel="Close saved drafts">
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        {savedDrafts.length === 0 ? (
                            <View style={styles.emptyDrafts}>
                                <Ionicons name="document-outline" size={34} color="#555" />
                                <Text style={styles.emptyDraftsText}>No saved drafts yet</Text>
                                <Text style={styles.emptyDraftsHint}>Use the gold Save draft button to keep your current design.</Text>
                            </View>
                        ) : (
                            <ScrollView style={styles.draftsList} contentContainerStyle={styles.draftsListContent}>
                                {savedDrafts.map((draft, index) => (
                                    <TouchableOpacity
                                        key={draft.id}
                                        style={styles.draftCard}
                                        onPress={() => loadDraft(draft)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Load draft saved ${new Date(draft.savedAt).toLocaleString()}`}
                                    >
                                        <View style={styles.draftCardIcon}>
                                            <Ionicons name="document-text-outline" size={20} color="#FFD700" />
                                        </View>
                                        <View style={styles.draftCardText}>
                                            <Text style={styles.draftCardTitle}>{index === 0 ? 'Latest draft' : `Draft ${savedDrafts.length - index}`}</Text>
                                            <Text style={styles.draftCardDate}>{new Date(draft.savedAt).toLocaleString()}</Text>
                                            <Text style={styles.draftCardType}>{draft.productType} · {draft.activeTab === 'ai' ? 'AI Design' : 'Manual'}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color="#777" />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showDatePicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowDatePicker(false)}
            >
                <View style={styles.dateModalOverlay}>
                    <View style={styles.dateModalCard}>
                        <View style={styles.dateModalHeader}>
                            <View>
                                <Text style={styles.dateModalTitle}>Choose pickup date</Text>
                                <Text style={styles.dateModalSubtitle}>Select a date at least 7 days ahead</Text>
                            </View>
                            <Ionicons name="calendar-outline" size={24} color="#FFD700" />
                        </View>

                        <DateTimePicker
                            value={selections.date}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                            minimumDate={MIN_DATE}
                            onValueChange={(_event, date) => {
                                updateSelection('date', date);
                                if (Platform.OS !== 'ios') setShowDatePicker(false);
                            }}
                            onDismiss={() => setShowDatePicker(false)}
                            style={styles.datePicker}
                        />

                        <View style={styles.dateModalActions}>
                            <TouchableOpacity
                                style={styles.dateCancelButton}
                                onPress={() => setShowDatePicker(false)}
                            >
                                <Text style={styles.dateCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.dateDoneButton}
                                onPress={() => setShowDatePicker(false)}
                            >
                                <Text style={styles.dateDoneText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    scrollContent: { flexGrow: 1, paddingBottom: 40 },
    previewSection: { width: '100%', backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    headerImage: { width: '100%', height: '100%' },
    aiAccuracyNotice: { position: 'absolute', left: 18, right: 18, bottom: 18, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.82)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#5A4A00' },
    aiAccuracyNoticeText: { flex: 1, color: '#fff', fontSize: 11, lineHeight: 16 },
    navigationBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 52, gap: 10 },
    navigationTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
    backBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    keyboardToolbar: { alignItems: 'flex-end', backgroundColor: '#111', borderTopWidth: 1, borderTopColor: '#333', paddingHorizontal: 16 },
    keyboardDoneButton: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
    previewInfoButton: { position: 'absolute', top: 52, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 18, padding: 7, borderWidth: 1, borderColor: '#5A4A00' },
    previewNotice: { position: 'absolute', left: 18, right: 18, bottom: 18, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.86)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#5A4A00' },
    draftActions: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 8, minHeight: 42, gap: 8 },
    saveDraftButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1A1600', borderWidth: 1, borderColor: '#FFD700', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
    draftButtonText: { color: '#FFD700', fontSize: 12, fontWeight: '800' },
    viewDraftsButton: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#161616', borderWidth: 1, borderColor: '#444', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
    viewDraftsButtonText: { color: '#fff', fontSize: 12, fontWeight: '800', flexShrink: 1 },
    draftCountBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#FFD700', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
    draftCountText: { color: '#000', fontSize: 11, fontWeight: '900' },
    draftsModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
    draftsModalCard: { maxHeight: '75%', backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, borderWidth: 1, borderColor: '#2a2a2a' },
    draftsModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
    draftsModalTitle: { color: '#FFD700', fontSize: 20, fontWeight: '900' },
    draftsModalSubtitle: { color: '#777', fontSize: 11, marginTop: 4 },
    draftsList: { flexGrow: 0 },
    draftsListContent: { gap: 10, paddingBottom: 8 },
    draftCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D0D0D', borderRadius: 16, borderWidth: 1, borderColor: '#292929', padding: 13 },
    draftCardIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#211D00', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    draftCardText: { flex: 1 },
    draftCardTitle: { color: '#fff', fontSize: 13, fontWeight: '800' },
    draftCardDate: { color: '#FFD700', fontSize: 11, marginTop: 3 },
    draftCardType: { color: '#777', fontSize: 10, marginTop: 3 },
    emptyDrafts: { alignItems: 'center', paddingVertical: 34 },
    emptyDraftsText: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 12 },
    emptyDraftsHint: { color: '#777', fontSize: 11, textAlign: 'center', marginTop: 6 },
    cakeStage: { alignItems: 'center' },
    canvasContainer: { width: '100%', height: '100%' },
    placeholderText: { color: '#FFD700', marginTop: 15, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
    productTypeContainer: { flexDirection: 'row', backgroundColor: '#111', marginHorizontal: 20, marginTop: 12, borderRadius: 20, padding: 6 },
    productTypeTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 15 },
    activeProductTypeTab: { backgroundColor: '#fff' },
    productTypeText: { color: '#777', fontWeight: '900', fontSize: 13 },
    activeProductTypeText: { color: '#000' },
    tabContainer: { flexDirection: 'row', backgroundColor: '#111', marginHorizontal: 20, marginTop: 12, borderRadius: 20, padding: 6, zIndex: 100 },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 15 },
    activeTab: { backgroundColor: '#FFD700' },
    tabText: { color: '#555', fontWeight: 'bold', fontSize: 13 },
    activeTabText: { color: '#000' },
    controls: { paddingHorizontal: 25, paddingTop: 10, paddingBottom: 60 },
    tipBox: { backgroundColor: '#111', padding: 12, borderRadius: 12, marginTop: 20, borderLeftWidth: 3, borderLeftColor: '#FFD700' },
    tipText: { color: '#AAA', fontSize: 11, fontStyle: 'italic' },
    sectionTitle: { color: '#FFD700', fontSize: 10, fontWeight: '900', marginBottom: 12, marginTop: 25, textTransform: 'uppercase' },
    inputField: { backgroundColor: '#0D0D0D', color: '#fff', padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#1A1A1A', minHeight: 100, textAlignVertical: 'top' },
    generateBtn: { backgroundColor: '#FFD700', padding: 18, borderRadius: 18, marginTop: 15, alignItems: 'center' },
    generateBtnText: { color: '#000', fontWeight: '900' },
    aiNote: { color: '#555', fontSize: 10, marginTop: 12, lineHeight: 14 },
    imageScroll: { flexDirection: 'row', paddingVertical: 5 },
    imageHint: { color: '#777', fontSize: 11, marginTop: -4, marginBottom: 8 },
    servingHint: { color: '#AAA', fontSize: 11, marginTop: 5, marginBottom: 4 },
    allergyNotice: { color: '#C9A94A', fontSize: 11, lineHeight: 16, marginTop: -4, marginBottom: 8 },
    addImgBtn: { width: 126, height: 80, backgroundColor: '#161616', borderRadius: 18, borderWidth: 1, borderColor: '#FFD700', borderStyle: 'dashed', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginRight: 12, paddingHorizontal: 10 },
    addImgIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    addImgText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    imageWrapper: { marginRight: 12 },
    refImage: { width: 80, height: 80, borderRadius: 18 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
    toppingsChipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    chip: { backgroundColor: '#0D0D0D', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginRight: 10, marginBottom: 10, borderWidth: 1, borderColor: '#1A1A1A' },
    toppingChip: { flexGrow: 1, flexBasis: '40%', alignItems: 'center' },
    activeChip: { backgroundColor: '#fff' },
    chipText: { color: '#777', fontSize: 12, fontWeight: 'bold' },
    activeChipText: { color: '#000' },
    addOptionButton: { paddingVertical: 10, alignItems: 'flex-start' },
    addOptionText: { color: '#FFD700', fontSize: 12, fontWeight: '800' },
    flavorPortionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0D0D0D', borderRadius: 14, padding: 10, marginBottom: 8 },
    flavorPackageCard: { backgroundColor: '#111', borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#252525' },
    savedDesignImage: { width: '100%', height: 180, borderRadius: 14, marginBottom: 12 },
    flavorPortionText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    flavorPortionControls: { flexDirection: 'row', gap: 8 },
    smallTierButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center' },
    flavorDetailLabel: { color: '#FFD700', fontSize: 11, fontWeight: '900', marginTop: 10, marginBottom: 8, textTransform: 'uppercase' },
    quantitySummary: { color: '#fff', backgroundColor: '#0D0D0D', borderRadius: 14, padding: 14, fontSize: 14, fontWeight: '800' },
    tierControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, backgroundColor: '#0D0D0D', borderRadius: 16, padding: 8 },
    tierButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center' },
    tierButtonText: { color: '#000', fontSize: 26, fontWeight: '900', lineHeight: 30 },
    tierCount: { color: '#fff', minWidth: 72, textAlign: 'center', fontSize: 15, fontWeight: '800' },
    selectionHint: { color: '#777', fontSize: 11, marginTop: -4, marginBottom: 8 },
    supportBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: '#222', padding: 15, marginHorizontal: 20, marginTop: 12, marginBottom: 4 },
    supportTextWrap: { flex: 1, marginLeft: 12 },
    supportTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
    supportSubtitle: { color: '#777', fontSize: 11, marginTop: 4 },
    dateSelector: { backgroundColor: '#111', flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 18, borderWidth: 1, borderColor: '#FFD700' },
    dateIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center' },
    dateTextWrap: { flex: 1, marginLeft: 13 },
    dateLabel: { color: '#FFD700', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
    dateText: { color: '#fff', fontWeight: '800', fontSize: 15, marginTop: 3 },
    dateHint: { color: '#777', fontSize: 10, marginTop: 4 },
    dateModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
    dateModalCard: { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, borderWidth: 1, borderColor: '#2a2a2a' },
    dateModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    dateModalTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
    dateModalSubtitle: { color: '#777', fontSize: 12, marginTop: 4 },
    datePicker: { alignSelf: 'center' },
    dateModalActions: { flexDirection: 'row', gap: 12, marginTop: 10 },
    dateCancelButton: { flex: 1, padding: 15, borderRadius: 14, alignItems: 'center', backgroundColor: '#1a1a1a' },
    dateCancelText: { color: '#aaa', fontWeight: '700' },
    dateDoneButton: { flex: 1, padding: 15, borderRadius: 14, alignItems: 'center', backgroundColor: '#FFD700' },
    dateDoneText: { color: '#000', fontWeight: '900' },
    confirmBtn: { backgroundColor: '#FFD700', padding: 20, borderRadius: 18, marginTop: 40, alignItems: 'center' },
    confirmBtnText: { color: '#000', fontWeight: '900', textTransform: 'uppercase' }
});
