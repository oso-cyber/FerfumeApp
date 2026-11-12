import { auth, db } from '@/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    addDoc,
    collection,
    doc,
    getDoc,
    onSnapshot,
    query,
    serverTimestamp,
    runTransaction,
    setDoc,
    Timestamp,
    where
} from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface Message {
    id: string;
    chatId: string;
    senderId: string;
    senderName: string;
    text: string;
    images?: string[];
    timestamp: Timestamp | null;
}

const localWelcomeMessage: Message = {
    id: 'local-welcome',
    chatId: '',
    senderId: 'local_assistant',
    senderName: 'Support Assistant',
    text: 'Hello! I am your Eldo Village Concierge. How can I assist you with your cake or custom order today?',
    timestamp: null,
};

export default function ChatScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ 
        roomId?: string;
        orderId?: string;
        orderName?: string;
        eventDate?: string;
        quotePrice?: string;
        source?: string;
        imageUrl?: string;
        adminMessage?: string;
    }>();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [detailsExpanded, setDetailsExpanded] = useState(false);
    const [activeChats, setActiveChats] = useState<any[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [inquiryContext, setInquiryContext] = useState<null | {
        orderId: string;
        orderName: string;
        eventDate: string;
        quotePrice: string;
        source: string;
        imageUrl: string;
        images?: string[];
        adminMessage: string;
    }>(null);
    const flatListRef = useRef<FlatList>(null);
    const slideAnim = useRef(new Animated.Value(-20)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const user = auth.currentUser;

    const resolveRoomId = useCallback(() => {
        if (typeof params.roomId === 'string' && params.roomId) return params.roomId;
        if (typeof params.orderId === 'string' && params.orderId) return `inquiry_${params.orderId}`;
        return user?.uid || 'default';
    }, [params.orderId, params.roomId, user?.uid]);

    const getChatName = (chat: any) => {
        if (chat?.source === 'custom_design') return chat.orderName || 'Custom cake request';
        if (chat?.source === 'custom' && chat?.orderId) return chat.orderId;
        if (chat?.orderId && !chat?.orderName) return chat.orderId;
        return chat?.orderName || chat?.userName || 'Support';
    };

    const showInquiryCard = Boolean(inquiryContext && (inquiryContext.orderId || inquiryContext.source === 'custom_design'));

    useEffect(() => {
        const roomId = resolveRoomId();
        const nextContext = params.orderId
            ? {
                orderId: String(params.orderId),
                orderName: String(params.orderName || 'Custom Order'),
                eventDate: String(params.eventDate || 'Date pending'),
                quotePrice: String(params.quotePrice || ''),
                source: String(params.source || 'custom'),
                imageUrl: String(params.imageUrl || ''),
                adminMessage: String(params.adminMessage || ''),
            }
            : null;

        setSelectedRoomId(roomId);
        setInquiryContext(nextContext);

        if (nextContext) {
            const introMessage = `Hello, I have a question about my ${nextContext.source === 'custom' ? 'custom order' : 'order'} "${nextContext.orderName}". My event date is ${nextContext.eventDate}${nextContext.quotePrice ? ` and the quote is R${nextContext.quotePrice}` : ''}.`;
            setInputText(introMessage);
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 90, friction: 9, useNativeDriver: true })
            ]).start();
        } else {
            setInputText('');
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: -20, duration: 180, useNativeDriver: true })
            ]).start();
        }
    }, [fadeAnim, params.adminMessage, params.eventDate, params.imageUrl, params.orderId, params.orderName, params.quotePrice, params.roomId, params.source, resolveRoomId, slideAnim, user?.uid]);

    useEffect(() => {
        if (!selectedRoomId) return;

        let isMounted = true;

        const hydrateInquiryFromRoom = async () => {
            const roomRef = doc(db, 'support_chats', selectedRoomId);
            const roomSnap = await getDoc(roomRef);

            if (!isMounted || !roomSnap.exists()) return;

            const roomData = roomSnap.data();
            let orderId = String(roomData.orderId || '').trim();

            if (!orderId && selectedRoomId.startsWith('inquiry_')) {
                orderId = selectedRoomId.replace(/^inquiry_/, '');
            }

            if (!orderId && roomData.source !== 'custom_design') {
                setInquiryContext(null);
                return;
            }

            let orderDocData: any = roomData;
            if (orderId && (!roomData.orderName || !roomData.eventDate || !roomData.imageUrl)) {
                const orderDocRef = doc(db, 'customer_orders', orderId);
                const orderDocSnap = await getDoc(orderDocRef);
                if (orderDocSnap.exists()) {
                    orderDocData = { ...orderDocData, ...orderDocSnap.data() };
                    await setDoc(roomRef, {
                        orderId,
                        orderName: orderDocData.cakeType || orderDocData.name || 'Custom Order',
                        eventDate: orderDocData.eventDate || '',
                        quotePrice: orderDocData.price ? String(orderDocData.price) : '',
                        source: 'custom',
                        imageUrl: orderDocData.imageUrl || (orderDocData.images && orderDocData.images[0]) || '',
                        adminMessage: orderDocData.adminMessage || orderDocData.customNotes || '',
                    }, { merge: true });
                }
            }

            const roomContext = {
                orderId,
                orderName: String(orderDocData.orderName || orderDocData.cakeType || orderDocData.name || 'Custom Order'),
                eventDate: String(orderDocData.eventDate || 'Date pending'),
                quotePrice: String(orderDocData.quotePrice || (orderDocData.price ? String(orderDocData.price) : '')),
                source: String(orderDocData.source || 'custom'),
                imageUrl: String(orderDocData.imageUrl || (orderDocData.images && orderDocData.images[0]) || ''),
                images: Array.isArray(orderDocData.images) ? orderDocData.images.filter((uri: unknown): uri is string => typeof uri === 'string' && /^https?:\/\//.test(uri)) : [],
                adminMessage: String(orderDocData.adminMessage || orderDocData.customNotes || ''),
            };

            setInquiryContext(roomContext);
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
                Animated.spring(slideAnim, { toValue: 0, tension: 90, friction: 9, useNativeDriver: true })
            ]).start();
        };

        void hydrateInquiryFromRoom().catch((error) => console.error('Could not load chat context:', error));
        return () => { isMounted = false; };
    }, [fadeAnim, params.orderId, selectedRoomId, slideAnim]);

    useEffect(() => {
        if (!user) return;

        const roomsQuery = query(
            collection(db, 'support_chats'),
            where('userId', '==', user.uid)
        );

        const unsubscribeRooms = onSnapshot(roomsQuery, (snapshot) => {
            const rooms = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data(),
            }));
            setActiveChats(rooms);
        });

        return () => unsubscribeRooms();
    }, [user]);

    useEffect(() => {
        if (!selectedRoomId) return;

        const q = query(
            collection(db, "messages"),
            where("chatId", "==", selectedRoomId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newMessages = snapshot.docs
                .filter((docSnap) => docSnap.id !== `${selectedRoomId}_design`)
                .map((docSnap) => {
                    const docData = docSnap.data() as Partial<Message>;

                    return {
                        id: docSnap.id,
                        chatId: docData.chatId ?? '',
                        senderId: docData.senderId ?? '',
                        senderName: docData.senderName ?? 'Support',
                        text: docData.text ?? '',
                        images: Array.isArray(docData.images) ? docData.images.filter((uri): uri is string => typeof uri === 'string' && /^https?:\/\//.test(uri)) : [],
                        timestamp: docData.timestamp ?? null,
                    } satisfies Message;
                })
                .sort((a, b) => (a.timestamp?.seconds ?? 0) - (b.timestamp?.seconds ?? 0));

            setMessages(newMessages.length === 0 ? [localWelcomeMessage] : newMessages);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        });

        return () => unsubscribe();
    }, [selectedRoomId]);

    const sendMessage = async () => {
        if (inputText.trim() === "" || !user || !selectedRoomId) return;

        const textToSend = inputText;
        setInputText(''); 

        try {
            await addDoc(collection(db, "messages"), {
                chatId: selectedRoomId,
                senderId: user.uid,
                senderName: user.email || "User",
                text: textToSend,
                timestamp: serverTimestamp()
            });

            await setDoc(doc(db, "support_chats", selectedRoomId), {
                id: selectedRoomId,
                roomId: selectedRoomId,
                userId: user.uid,
                userName: user.email || "Customer",
                lastMessage: textToSend,
                updatedAt: serverTimestamp(),
                unreadAdmin: true,
                customerReadAt: serverTimestamp(),
                unreadCustomer: false,
                status: 'active',
            }, { merge: true });

        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    useEffect(() => {
        if (!selectedRoomId || !user) return;

        const roomRef = doc(db, 'support_chats', selectedRoomId);
        runTransaction(db, async (transaction) => {
            const existing = await transaction.get(roomRef);
            if (existing.exists()) return;
            transaction.set(roomRef, {
            id: selectedRoomId,
            roomId: selectedRoomId,
            userId: user.uid,
            userName: user.email || "Customer",
            orderName: inquiryContext?.orderName || 'Concierge Support',
            orderId: inquiryContext?.orderId || '',
            eventDate: inquiryContext?.eventDate || '',
            quotePrice: inquiryContext?.quotePrice || '',
            source: inquiryContext?.source || 'custom',
            imageUrl: inquiryContext?.imageUrl || '',
            adminMessage: inquiryContext?.adminMessage || '',
            lastMessage: inquiryContext?.adminMessage || 'New inquiry started',
            updatedAt: serverTimestamp(),
            unreadAdmin: true,
            customerReadAt: serverTimestamp(),
            unreadCustomer: false,
            status: 'active',
            });
        }).catch(error => {
            console.error("Error creating support room:", error);
        });
    }, [selectedRoomId, user, inquiryContext?.orderName, inquiryContext?.orderId, inquiryContext?.eventDate, inquiryContext?.quotePrice, inquiryContext?.source, inquiryContext?.imageUrl, inquiryContext?.adminMessage]);

    const renderItem = ({ item }: { item: Message }) => {
        const isMe = item.senderId === user?.uid;
        // Older design messages stored attachment URLs at the end of the text.
        const legacyImages = item.id.endsWith('_design')
            ? item.text.match(/\n\nDesign images:\n((?:https?:\/\/\S+\s*)+)$/)
            : null;
        const text = legacyImages ? item.text.slice(0, legacyImages.index) : item.text;
        const images = [...new Set([...(item.images ?? []), ...(legacyImages?.[1].match(/https?:\/\/\S+/g) ?? [])])];
        return (
            <View style={[styles.messageRow, isMe ? styles.myMsgRow : styles.theirMsgRow]}>
                {!isMe && (
                    <View style={styles.avatar}>
                        <Ionicons name="person" size={12} color="#000" />
                    </View>
                )}
                <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                    <Text style={[styles.msgText, isMe ? styles.myText : styles.theirText]}>
                        {text}
                    </Text>
                    {images.map((uri, index) => (
                        <Image
                            key={uri}
                            source={{ uri }}
                            resizeMode="contain"
                            accessibilityLabel={`Shared cake design ${index + 1}`}
                            style={{ width: 220, maxWidth: '100%', aspectRatio: 1, borderRadius: 12, marginTop: 10, backgroundColor: '#191919' }}
                        />
                    ))}
                    <Text style={[styles.timeText, { color: isMe ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }]}>
                        {item.timestamp?.toDate() 
                            ? item.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                            : '...'}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
            style={styles.container}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>{inquiryContext?.source === 'custom_design' ? 'CUSTOM DESIGN CHAT' : 'CONCIERGE CHAT'}</Text>
                    {/* FIXED: Replaced <div> with <View> */}
                    <View style={styles.statusRow}>
                        <View style={styles.onlineDot} />
                        <Text style={styles.statusText}>Online</Text>
                    </View>
                </View>
            </View>

            {showInquiryCard && inquiryContext && (
                <Animated.View
                    style={[
                        styles.inquiryCard,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        }
                    ]}
                >
                    <View style={styles.inquiryHeadRow}>
                        {inquiryContext.imageUrl ? (
                            <Image source={{ uri: inquiryContext.imageUrl }} style={styles.inquiryImage} />
                        ) : (
                            <View style={styles.inquiryImagePlaceholder}>
                                <Ionicons name="image-outline" size={18} color="#FFD700" />
                            </View>
                        )}
                        <View style={styles.inquiryTextWrap}>
                            <View style={styles.inquiryBadgeRow}>
                                <Ionicons name="calendar-outline" size={12} color="#FFD700" />
                                <Text style={styles.inquiryBadge}>{inquiryContext.source === 'custom_design' ? 'CUSTOM CAKE REQUEST' : 'ORDER INQUIRY'}</Text>
                            </View>
                            <Text style={styles.inquiryTitle}>{inquiryContext.orderName}</Text>
                        </View>
                    </View>
                    <Text style={styles.inquiryMeta}>📅 {inquiryContext.eventDate}</Text>
                    {inquiryContext.quotePrice ? (
                        <Text style={styles.inquiryMeta}>💰 Quote: R{inquiryContext.quotePrice}</Text>
                    ) : null}
                    {(inquiryContext.images?.length || inquiryContext.imageUrl) ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 10, paddingVertical: 10 }}>
                            {[...new Set([...(inquiryContext.images ?? []), inquiryContext.imageUrl].filter(Boolean))].map((uri, index) => (
                                <Image key={uri} source={{ uri }} resizeMode="contain"
                                    accessibilityLabel={`Cake design image ${index + 1}`}
                                    style={{ width: 160, height: 140, borderRadius: 12, backgroundColor: '#191919' }} />
                            ))}
                        </ScrollView>
                    ) : null}
                    {inquiryContext.adminMessage ? (
                        <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled><Text style={styles.inquiryMessage} numberOfLines={detailsExpanded ? undefined : 2}>
                            {inquiryContext.adminMessage}
                        </Text></ScrollView>
                    ) : null}
                    {!!inquiryContext.adminMessage && <TouchableOpacity onPress={() => setDetailsExpanded((value) => !value)}><Text style={{ color: '#FFD700', paddingVertical: 8 }}>{detailsExpanded ? 'Hide details' : 'View details'}</Text></TouchableOpacity>}
                </Animated.View>
            )}

            {activeChats.length > 0 && (
                <View style={styles.chatListSection}>
                    <Text style={styles.chatListTitle}>Active chats</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chatListScroll}
                    >
                        {activeChats.map((chat) => {
                            const isSelected = (chat.roomId || chat.id) === selectedRoomId;
                            const thisChatName = getChatName(chat);
                            return (
                                <TouchableOpacity
                                    key={chat.id}
                                    style={[styles.chatRoomChip, isSelected && styles.chatRoomChipSelected]}
                                    onPress={() => {
                                        const nextRoomId = chat.roomId || chat.id;
                                        if (!nextRoomId) return;

                                        setSelectedRoomId(nextRoomId);
                                        setInputText('');

                                        if (chat.orderId || chat.orderName || chat.eventDate || chat.imageUrl) {
                                            setInquiryContext({
                                                orderId: String(chat.orderId || ''),
                                                orderName: String(chat.orderName || chat.userName || 'Custom Order'),
                                                eventDate: String(chat.eventDate || 'Date pending'),
                                                quotePrice: String(chat.quotePrice || ''),
                                                source: String(chat.source || 'custom'),
                                                imageUrl: String(chat.imageUrl || ''),
                                                images: Array.isArray(chat.images) ? chat.images.filter((uri: unknown): uri is string => typeof uri === 'string' && /^https?:\/\//.test(uri)) : [],
                                                adminMessage: String(chat.adminMessage || ''),
                                            });
                                        } else {
                                            setInquiryContext(null);
                                        }
                                    }}
                                >
                                    <Text style={[styles.chatRoomChipText, isSelected && styles.chatRoomChipTextSelected]} numberOfLines={1}>
                                        {thisChatName}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
            />

            {/* INPUT AREA */}
            <View style={styles.inputWrapper}>
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        placeholderTextColor="#444"
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />
                    <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
                        <Ionicons name="send" size={20} color="#000" />
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#111' },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
    headerTitleContainer: { marginLeft: 15 },
    headerTitle: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 2 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4BB543', marginRight: 5 },
    statusText: { color: '#4BB543', fontSize: 10, fontWeight: 'bold' },

    listContent: { padding: 20 },
    chatListSection: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 4 },
    chatListTitle: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
    chatListScroll: { paddingRight: 10 },
    chatRoomChip: {
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#2a2a2a',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginRight: 10,
    },
    chatRoomChipSelected: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
    chatRoomChipText: { color: '#fff', fontSize: 12, fontWeight: '700', maxWidth: 150 },
    chatRoomChipTextSelected: { color: '#000' },
    inquiryCard: {
        marginHorizontal: 18,
        marginTop: 12,
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#2b2b2b',
        borderRadius: 18,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
        elevation: 4,
    },
    inquiryHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    inquiryImage: { width: 54, height: 54, borderRadius: 12, marginRight: 10 },
    inquiryImagePlaceholder: { width: 54, height: 54, borderRadius: 12, marginRight: 10, backgroundColor: '#1d1d1d', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3b3b3b' },
    inquiryTextWrap: { flex: 1 },
    inquiryBadgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    inquiryBadge: { color: '#FFD700', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginLeft: 6 },
    inquiryTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 6 },
    inquiryMeta: { color: '#d8d8d8', fontSize: 12, marginBottom: 4 },
    inquiryMessage: { color: '#bdbdbd', fontSize: 11, marginTop: 6, lineHeight: 16 },
    messageRow: { marginBottom: 15, flexDirection: 'row', alignItems: 'flex-end' },
    myMsgRow: { justifyContent: 'flex-end' },
    theirMsgRow: { justifyContent: 'flex-start' },
    avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    
    bubble: { maxWidth: '80%', padding: 15, borderRadius: 20 },
    myBubble: { backgroundColor: '#FFD700', borderBottomRightRadius: 4 },
    theirBubble: { backgroundColor: '#111', borderBottomLeftRadius: 4 },
    
    msgText: { fontSize: 14, lineHeight: 20 },
    myText: { color: '#000', fontWeight: '500' },
    theirText: { color: '#fff' },
    timeText: { fontSize: 9, marginTop: 5, alignSelf: 'flex-end' },

    inputWrapper: { padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20, backgroundColor: '#000' },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', borderRadius: 25, paddingHorizontal: 15, paddingVertical: 10, borderWidth: 1, borderColor: '#111' },
    input: { flex: 1, color: '#fff', fontSize: 14, maxHeight: 100 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center', marginLeft: 10 }
});
