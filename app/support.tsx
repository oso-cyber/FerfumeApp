import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
    collection,
    doc,
    onSnapshot,
    query,
    updateDoc,
    where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    LayoutAnimation,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth, db } from '../firebaseConfig';

interface ChatRoom {
    id: string;
    roomId?: string;
    userId?: string;
    userName?: string;
    orderId?: string;
    orderName?: string;
    eventDate?: string;
    quotePrice?: string;
    source?: string;
    imageUrl?: string;
    adminMessage?: string;
    lastMessage?: string;
    updatedAt?: any;
    unreadUser?: boolean;
    status?: 'active' | 'pending' | 'resolved';
}

const FAQS = [
    {
        question: "Can I request a custom cake design?",
        answer: "Yes. We create bespoke cake designs for birthdays, weddings, corporate events, and luxury gifting occasions."
    },
    {
        question: "Do you offer cake consultations before ordering?",
        answer: "Absolutely. Our team can help you refine the design, flavour, size, and finishing touches before production begins."
    },
    {
        question: "What cake flavours do you offer?",
        answer: "We offer a curated range of luxury flavours including vanilla bean, chocolate ganache, red velvet, lemon zest, and seasonal signature options."
    },
    {
        question: "Can I order a gluten-free or dairy-free cake?",
        answer: "Yes, we can accommodate dietary preferences where possible. Please let us know your requirements when placing the request so we can advise the best option."
    },
    {
        question: "Do you do wedding cakes?",
        answer: "Yes. We design luxury wedding cakes, statement dessert tables, and elegant celebration cakes tailored to the event theme and guest count."
    },
    {
        question: "How far in advance should I place my order?",
        answer: "We recommend booking as early as possible, especially for weddings and large events. Peak periods may require a longer lead time."
    },
    {
        question: "Can I get a cake delivered?",
        answer: "Yes. We offer delivery options for select orders, with timing and logistics arranged according to your location and event requirements."
    },
    {
        question: "Can I request a cake with my own design theme?",
        answer: "Yes. We can build around your colour palette, event styling, floral theme, and personal inspiration for a fully custom finish."
    },
    {
        question: "Do you offer cupcakes or dessert add-ons?",
        answer: "Yes. We can add luxury cupcakes, mini desserts, and coordinated sweet accompaniments to complement your main cake order."
    },
    {
        question: "How do I choose the right cake size?",
        answer: "We can guide you based on your guest count, serving style, and the kind of statement finish you want for the event."
    },
    {
        question: "Can I make changes after ordering?",
        answer: "Yes, depending on the stage of production. We’re happy to discuss adjustments as early as possible to accommodate design and flavour updates."
    },
    {
        question: "Are your cakes safe for nut allergies?",
        answer: "We handle ingredients carefully, but we cannot guarantee a completely nut-free environment. Please disclose all allergies when ordering."
    },
    {
        question: "Do you offer luxury gift cakes?",
        answer: "Yes. We create elegant gift cakes for milestones, thank-you gestures, anniversaries, and premium personal celebrations."
    },
    {
        question: "Can I book a tasting session?",
        answer: "Yes. Private tastings can be arranged for relevant custom orders and event consultations."
    },
    {
        question: "Is there a minimum spend for custom orders?",
        answer: "Minimums may apply depending on the design complexity, guest count, and event requirements. Our concierge team can confirm details for your request."
    },
    {
        question: "Do you offer corporate cake orders?",
        answer: "Yes. We design premium cakes and dessert displays for launches, client gifting, corporate events, and executive celebrations."
    },
    {
        question: "Can I add fresh flowers or luxury styling?",
        answer: "Yes. We offer a range of finishing details, including floral styling, premium textures, and elegant presentation elements."
    },
    {
        question: "How do I speak to someone about my order?",
        answer: "You can start a new inquiry directly in the concierge chat, and our team will guide you through the next steps for your cake order."
    },
    {
        question: "Can I get a quote for a custom celebration cake?",
        answer: "Yes. Share your event details, preferred design direction, and guest count and our team will prepare a tailored quote."
    },
    {
        question: "What is your cancellation policy?",
        answer: "Cancellations are subject to the timing of your order and production schedule. We recommend confirming changes as early as possible."
    }
];

export default function SupportScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    // Dynamic Chat States
    const [activeChats, setActiveChats] = useState<ChatRoom[]>([]);
    const [chatRequests, setChatRequests] = useState<ChatRoom[]>([]);
    const [loadingChats, setLoadingChats] = useState<boolean>(true);

    const currentUser = auth.currentUser;

    // Listen for live user chats and admin-initiated requests
    useEffect(() => {
        if (!currentUser) {
            setLoadingChats(false);
            return;
        }

        // Listener 1: Active user ongoing chats (ID equals user's UID)
        const chatDocRef = query(collection(db, 'support_chats'), where('userId', '==', currentUser.uid));
        const unsubscribeChat = onSnapshot(chatDocRef, (snapshot) => {
            const rooms = snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as ChatRoom));
            setActiveChats(rooms.filter((room) => room.status !== 'pending' && room.status !== 'resolved')
                .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0)));
        });

        // Listener 2: Admin-initiated chat requests targeted to this user
        const requestsQuery = query(
            collection(db, 'support_chats'),
            where('userId', '==', currentUser.uid),
            where('status', '==', 'pending')
        );

        const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
            const requests = snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as ChatRoom[];

            setChatRequests(requests);
            setLoadingChats(false);
        }, () => {
            setLoadingChats(false);
        });

        return () => {
            unsubscribeChat();
            unsubscribeRequests();
        };
    }, [currentUser]);

    const handleOpenChat = async (roomId: string, chat?: ChatRoom) => {
        // Clear user unread badge when opening
        try {
            await updateDoc(doc(db, 'support_chats', roomId), {
                unreadUser: false,
            });
        } catch {
            // Document might be handled on next screen
        }
        router.push({
            pathname: '/chat',
            params: {
                roomId,
                orderId: chat?.orderId || '',
                orderName: chat?.orderName || '',
                eventDate: chat?.eventDate || '',
                quotePrice: chat?.quotePrice || '',
                source: chat?.source || 'custom',
                imageUrl: chat?.imageUrl || '',
                adminMessage: chat?.adminMessage || '',
            }
        });
    };

    const getChatDisplayName = (chat?: ChatRoom) => {
        if (!chat) return 'Support';
        if (chat.source === 'custom_design') return chat.orderName || 'Custom cake request';
        if (chat.source === 'custom' && chat.orderId) return chat.orderId;
        if (chat.orderId && !chat.orderName) return chat.orderId;
        return chat.orderName || chat.userName || 'Support';
    };

    const filteredFAQs = FAQS.filter(
        (faq) =>
            faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 3);

    const toggleFAQ = (index: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedIndex(expandedIndex === index ? null : index);
    };

    const contactMethod = (
        icon: string,
        label: string,
        color: string,
        action: () => void
    ) => (
        <TouchableOpacity style={styles.contactTile} onPress={action}>
            <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon as any} size={22} color={color} />
            </View>
            <Text style={styles.contactLabel}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* HEADER */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Concierge Support</Text>
                </View>

                {/* PRIMARY CONCIERGE BUTTON */}
                <TouchableOpacity
                    style={styles.supportProBtn}
                    onPress={() => router.push('/chat')}
                >
                    <View style={styles.supportProLeft}>
                        <View style={styles.conciergeCircle}>
                            <Ionicons name="person-circle-outline" size={32} color="#000" />
                        </View>
                        <View>
                            <Text style={styles.supportProTitle}>Speak to Concierge</Text>
                            <Text style={styles.supportProSub}>Start a new inquiry</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#000" />
                </TouchableOpacity>

                {/* --- CHAT REQUESTS & ONGOING CHATS SECTION --- */}
                {loadingChats ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color="#FFD700" />
                    </View>
                ) : (
                    <>
                        {/* ADMIN CHAT REQUESTS */}
                        {chatRequests.length > 0 && (
                            <View style={styles.sectionContainer}>
                                <Text style={styles.sectionTitleAlert}>
                                    <Ionicons name="alert-circle" size={12} color="#FFD700" /> Admin Chat Requests
                                </Text>
                                {chatRequests.map((item) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[styles.chatCard, styles.requestCardBorder]}
                                        onPress={() => handleOpenChat(item.id, item)}
                                    >
                                        <View style={styles.chatAvatar}>
                                            <Ionicons name="shield-checkmark" size={20} color="#FFD700" />
                                        </View>
                                        <View style={styles.chatDetails}>
                                            <Text style={styles.chatTitle}>{getChatDisplayName(item)}</Text>
                                            <Text style={styles.chatSub} numberOfLines={1}>
                                                {item.lastMessage || 'An admin has requested a conversation.'}
                                            </Text>
                                        </View>
                                        <View style={styles.actionBadge}>
                                            <Text style={styles.actionBadgeText}>Accept</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* ONGOING CHATS */}
                        {(activeChats.length > 0 || (!loadingChats && chatRequests.length === 0)) && (
                            <View style={styles.sectionContainer}>
                                <Text style={styles.sectionTitle}>Ongoing Conversations</Text>
                                {activeChats.length > 0 ? (
                                    activeChats.map((item) => (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={styles.chatCard}
                                            onPress={() => handleOpenChat(item.id, item)}
                                        >
                                            <View style={styles.chatAvatarActive}>
                                                <Ionicons name="chatbubbles" size={20} color="#000" />
                                            </View>
                                            <View style={styles.chatDetails}>
                                                <Text style={styles.chatTitle}>{getChatDisplayName(item)}</Text>
                                                <Text style={styles.chatSub} numberOfLines={1}>
                                                    {item.lastMessage || 'Tap to resume conversation...'}
                                                </Text>
                                            </View>
                                            {item.unreadUser ? (
                                                <View style={styles.unreadBadge}>
                                                    <Text style={styles.unreadBadgeText}>NEW</Text>
                                                </View>
                                            ) : (
                                                <Ionicons name="chevron-forward" size={18} color="#666" />
                                            )}
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <View style={styles.emptyStateCard}>
                                        <Text style={styles.emptyStateTitle}>No active chats yet</Text>
                                        <Text style={styles.emptyStateText}>Start a new inquiry to begin a custom-order conversation.</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </>
                )}

                {/* QUICK ACTIONS ROW */}
                <View style={styles.actionsRow}>
                    {contactMethod('logo-whatsapp', 'WhatsApp', '#25D366', () =>
                        Linking.openURL('whatsapp://send?phone=+27825316033')
                    )}
                    {contactMethod('mail-outline', 'Email Us', '#FFD700', () =>
                        Linking.openURL('mailto:exquisitedeluxecakes@gmail.com')
                    )}
                    {contactMethod('call-outline', 'Call Now', '#fff', () =>
                        Linking.openURL('tel:+27825316033')
                    )}
                </View>

                {/* SEARCH BAR */}
                <View style={styles.searchWrapper}>
                    <Ionicons name="search" size={20} color="#444" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search for help..."
                        placeholderTextColor="#444"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                <View style={styles.divider} />

                {/* FAQ SECTION */}
                <Text style={styles.sectionTitle}>
                    {searchQuery ? 'Top Search Results' : 'Common Questions'}
                </Text>

                {filteredFAQs.length > 0 ? (
                    filteredFAQs.map((faq, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.faqCard}
                            onPress={() => toggleFAQ(index)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.faqHeader}>
                                <Text style={styles.faqQuestion}>{faq.question}</Text>
                                <Ionicons
                                    name={expandedIndex === index ? 'remove' : 'add'}
                                    size={18}
                                    color="#FFD700"
                                />
                            </View>
                            {expandedIndex === index && (
                                <Text style={styles.faqAnswer}>{faq.answer}</Text>
                            )}
                        </TouchableOpacity>
                    ))
                ) : (
                    <Text style={styles.noResults}>No matching results in Gauteng HQ database.</Text>
                )}

                <View style={styles.footer}>
                    <Text style={styles.footerText}>ELDORAIGNE • GAUTENG</Text>
                    <Text style={styles.footerSubText}>Available Mon - Sat | 08:00 - 18:00</Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    scrollContent: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#111',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '900',
        marginLeft: 15,
        letterSpacing: 2,
        textTransform: 'uppercase',
    },

    // Support Primary Button
    supportProBtn: {
        backgroundColor: '#FFD700',
        padding: 20,
        borderRadius: 25,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    supportProLeft: { flexDirection: 'row', alignItems: 'center' },
    conciergeCircle: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    supportProTitle: { color: '#000', fontSize: 16, fontWeight: '900' },
    supportProSub: { color: 'rgba(0,0,0,0.6)', fontSize: 11, fontWeight: '700' },

    // Chats & Requests Section
    loadingContainer: { marginVertical: 15, alignItems: 'center' },
    sectionContainer: { marginBottom: 20 },
    sectionTitle: {
        color: '#666',
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 10,
    },
    sectionTitleAlert: {
        color: '#FFD700',
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 10,
    },
    chatCard: {
        backgroundColor: '#0a0a0a',
        padding: 15,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#111',
    },
    requestCardBorder: {
        borderColor: '#FFD700',
        backgroundColor: '#111100',
    },
    chatAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#222',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    chatAvatarActive: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFD700',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    chatDetails: { flex: 1 },
    chatTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
    chatSub: { color: '#888', fontSize: 12, marginTop: 2 },
    unreadBadge: {
        backgroundColor: '#FF3B30',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    unreadBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
    actionBadge: {
        backgroundColor: '#FFD700',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    actionBadgeText: { color: '#000', fontSize: 11, fontWeight: '900' },
    emptyStateCard: {
        backgroundColor: '#0a0a0a',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#1a1a1a',
        padding: 18,
    },
    emptyStateTitle: { color: '#fff', fontSize: 14, fontWeight: '800', marginBottom: 4 },
    emptyStateText: { color: '#888', fontSize: 12, lineHeight: 18 },

    // Search Bar
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0a0a0a',
        borderRadius: 15,
        paddingHorizontal: 15,
        height: 55,
        borderWidth: 1,
        borderColor: '#111',
        marginBottom: 5,
    },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, color: '#fff', fontSize: 14 },

    actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
    contactTile: {
        flex: 1,
        backgroundColor: '#0a0a0a',
        padding: 15,
        borderRadius: 20,
        alignItems: 'center',
        marginHorizontal: 5,
        borderWidth: 1,
        borderColor: '#111',
    },
    iconCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    contactLabel: { color: '#fff', fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },

    divider: { height: 1, backgroundColor: '#111', marginVertical: 20 },

    faqCard: {
        backgroundColor: '#0a0a0a',
        padding: 20,
        borderRadius: 20,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#111',
    },
    faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    faqQuestion: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1, paddingRight: 10 },
    faqAnswer: { color: '#999', fontSize: 13, marginTop: 15, lineHeight: 20 },
    noResults: {
        color: '#333',
        textAlign: 'center',
        marginTop: 30,
        fontSize: 13,
        fontStyle: 'italic',
    },

    footer: { marginTop: 40, alignItems: 'center' },
    footerText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 3, marginBottom: 5 },
    footerSubText: { color: '#444', fontSize: 11 },
});
