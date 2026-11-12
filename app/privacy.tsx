import { auth, db } from '@/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export default function PrivacyScreen() {
    const router = useRouter();
    const [hasAgreed, setHasAgreed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const user = auth.currentUser;

    useEffect(() => {
        checkAgreementStatus();
    }, []);

    const checkAgreementStatus = async () => {
        if (!user) return setLoading(false);
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists() && userDoc.data().agreedToTerms) {
                setHasAgreed(true);
            }
        } catch (e) {
            console.error("Error checking status:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleAgree = async () => {
        if (!user) return Alert.alert("Error", "You must be logged in.");
        
        setSubmitting(true);
        try {
            // Update the user document with agreement data for legal proof
            await updateDoc(doc(db, "users", user.uid), {
                agreedToTerms: true,
                agreementTimestamp: serverTimestamp(),
                agreementVersion: "1.0.4"
            });
            setHasAgreed(true);
            Alert.alert("Success", "Your agreement has been recorded.");
        } catch (e) {
            Alert.alert("Error", "Could not record agreement.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center' }]}>
                <ActivityIndicator color="#FFD700" size="large" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#FFD700" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.title}>LEGAL & PRIVACY</Text>
                    <Text style={styles.version}>v1.0.4 • Gauteng Jurisdiction</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {hasAgreed && (
                    <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={18} color="#4BB543" />
                        <Text style={styles.verifiedText}>AGREEMENT RECORDED ON FILE</Text>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>1. TOTAL INDEMNITY</Text>
                    <Text style={styles.text}>
                        The user hereby unconditionally indemnifies Eldo Village against any and all claims. Use of this service constitutes total acceptance of risk.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>2. R50,000 PENALTY CLAUSE</Text>
                    <View style={styles.penaltyBox}>
                        <Text style={styles.penaltyText}>
                            Any user initiating legal action in violation of these terms agrees to an immediate Liquidated Damages penalty of R50,000.00.
                        </Text>
                    </View>
                </View>

                {/* Rest of your sections here... */}
            </ScrollView>

            {/* CONDITIONAL FOOTER */}
            {!hasAgreed ? (
                <View style={styles.footer}>
                    <TouchableOpacity 
                        style={styles.agreeBtn} 
                        onPress={handleAgree}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text style={styles.agreeBtnText}>I AGREE TO ALL CONDITIONS</Text>
                        )}
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.footer}>
                    <TouchableOpacity style={[styles.agreeBtn, { backgroundColor: '#111' }]} onPress={() => router.back()}>
                        <Text style={[styles.agreeBtnText, { color: '#666' }]}>RETURN TO APP</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#111' },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    title: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 2 },
    version: { color: '#444', fontSize: 10, marginTop: 2 },
    content: { padding: 25 },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(75, 181, 67, 0.1)', padding: 12, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#4BB543' },
    verifiedText: { color: '#4BB543', fontSize: 11, fontWeight: '900', marginLeft: 10 },
    section: { marginBottom: 30 },
    sectionTitle: { color: '#FFD700', fontSize: 11, fontWeight: 'bold', marginBottom: 10 },
    text: { color: '#999', lineHeight: 22, fontSize: 13 },
    penaltyBox: { backgroundColor: '#0a0a0a', padding: 15, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#FFD700' },
    penaltyText: { color: '#fff', fontSize: 13, fontWeight: 'bold', fontStyle: 'italic' },
    footer: { padding: 25, borderTopWidth: 1, borderTopColor: '#111' },
    agreeBtn: { backgroundColor: '#FFD700', padding: 18, borderRadius: 15, alignItems: 'center' },
    agreeBtnText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 1 }
});