import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialIcons, Ionicons, FontAwesome } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';

// --- Configuration & Language Data ---

const PRIMARY_BLUE = '#1A73E8'; // Google's primary blue
const ACCENT_COLOR = '#4B5563'; // Gray for icons
const BG_OFF_WHITE = '#F8F9FA'; // Standard Google light background

const languageList = [
  { code: 'en', label: 'English', isOfflineReady: true },
  { code: 'ceb', label: 'Cebuano', isOfflineReady: false }, // Initially false, changes after download
  { code: 'tl', label: 'Tagalog (Filipino)', isOfflineReady: true },
  { code: 'es', label: 'Spanish', isOfflineReady: true },
  { code: 'ko', label: 'Korean', isOfflineReady: true },
];

const screenWidth = Dimensions.get('window').width;

// --- Custom Hook for Translation Logic & Native Bridging ---

const useTranslationEngine = () => {
  const [sourceLang, setSourceLang] = useState(languageList[0].code);
  const [targetLang, setTargetLang] = useState(languageList[1].code);
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState(
    languageList.reduce((acc, lang) => ({ ...acc, [lang.code]: lang.isOfflineReady }), {})
  );

  // [PLACEHOLDER] for actual translation.
  // This function simulates the ML Kit native call.
  // Replace this with the actual ML Kit bridge call (e.g., using @react-native-ml-kit/translate)
  const performTranslation = useCallback(async (text, src, tgt) => {
    if (!text || src === tgt) {
      setOutputText('');
      return;
    }

    setIsTranslating(true);
    console.log(`[ML Kit Simulate] Translating '${text}' from ${src} to ${tgt}`);

    // Simulation: Simulating a 500ms neural network inference time.
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Simple simulation logic (you will replace this with your real model result)
    if (text.toLowerCase() === 'dog' && src === 'en' && tgt === 'ceb') {
      setOutputText('iro');
    } else {
      setOutputText(`${tgt.toUpperCase()}_MOCK: ${text}`);
    }

    setIsTranslating(false);
  }, []);

  // [PLACEHOLDER] for downloading offline models.
  const downloadModel = useCallback(async (langCode) => {
    console.log(`[ML Kit Simulate] Downloading model for: ${langCode}`);
    // Simulate a download delay.
    await new Promise((resolve) => setTimeout(resolve, 3000));
    setOfflineStatus((prev) => ({ ...prev, [langCode]: true }));
    console.log(`[ML Kit Simulate] Download complete for: ${langCode}`);
  }, []);

  const swapLanguages = useCallback(() => {
    const oldSource = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(oldSource);
    setInputText(outputText);
    // Translation will trigger in useEffect.
  }, [sourceLang, targetLang, outputText]);

  // Handle translation triggering.
  React.useEffect(() => {
    performTranslation(inputText, sourceLang, targetLang);
  }, [inputText, sourceLang, targetLang, performTranslation]);

  // Initial check or setup for offline models (simulate)
  React.useEffect(() => {
    const checkModels = async () => {
      // You might check if models are already on disk here.
      // We simulate Cebuano needing a download.
      if (!offlineStatus[targetLang]) {
        await downloadModel(targetLang);
      }
    };
    checkModels();
  }, [targetLang, offlineStatus, downloadModel]);

  return {
    sourceLang,
    setSourceLang,
    targetLang,
    setTargetLang,
    inputText,
    setInputText,
    outputText,
    isTranslating,
    swapLanguages,
    offlineStatus,
  };
};

// --- Reusable Sub-Components for the UI ---

const HeaderPill = ({ lang, isOfflineReady, onPress, side }) => (
  <TouchableOpacity
    style={[styles.headerPill, side === 'right' ? { marginRight: 2 } : { marginLeft: 2 }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.headerPillContent}>
      <Text style={[styles.headerPillText, { color: PRIMARY_BLUE }]}>
        {languageList.find((l) => l.code === lang).label}
      </Text>
      <MaterialIcons name="arrow-drop-down" size={24} color={PRIMARY_BLUE} />
      {isOfflineReady && (
        <Ionicons name="checkmark-done-circle" size={16} color={PRIMARY_BLUE} style={{ marginLeft: -4 }} />
      )}
    </View>
  </TouchableOpacity>
);

const IconButton = ({ name, type = 'Ionicons', size = 24, color = ACCENT_COLOR, onPress, style }) => {
  const IconComponent = type === 'Ionicons' ? Ionicons : type === 'MaterialIcons' ? MaterialIcons : FontAwesome;
  return (
    <TouchableOpacity onPress={onPress} style={[styles.iconButton, style]}>
      <IconComponent name={name} size={size} color={color} />
    </TouchableOpacity>
  );
};

// --- Main Screen Component ---

const CebuanoTranslatorScreen = () => {
  const {
    sourceLang,
    setSourceLang,
    targetLang,
    setTargetLang,
    inputText,
    setInputText,
    outputText,
    isTranslating,
    swapLanguages,
    offlineStatus,
  } = useTranslationEngine();

  // Bottom Sheet state
  const bottomSheetRef = useRef(null);
  const [selectingMode, setSelectingMode] = useState(null); // 'source' or 'target'
  const snapPoints = useMemo(() => ['50%', '80%'], []);

  const openLanguageSelector = (mode) => {
    setSelectingMode(mode);
    bottomSheetRef.current?.expand();
  };

  const handleLanguageSelect = (langCode) => {
    if (selectingMode === 'source') {
      setSourceLang(langCode);
    } else {
      setTargetLang(langCode);
    }
    bottomSheetRef.current?.close();
  };

  // Speaker and mic actions [PLACEHOLDERS]
  const handleSpeak = (text) => {
    if (!text) return;
    console.log(`[TTS Placeholder] Speaking: "${text}" in ${selectingMode === 'source' ? sourceLang : targetLang}`);
    // Replace with Text-to-Speech library (like expo-speech)
  };

  const handleMicPress = () => {
    console.log('[STT Placeholder] Listening...');
    // Replace with Speech-to-Text library (like @react-native-voice/voice)
  };

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    ),
    []
  );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        {/* --- Language Selector Header --- */}
        <View style={styles.header}>
          <HeaderPill
            lang={sourceLang}
            isOfflineReady={offlineStatus[sourceLang]}
            onPress={() => openLanguageSelector('source')}
            side="left"
          />
          <IconButton name="swap-horizontal" type="MaterialIcons" onPress={swapLanguages} style={styles.swapIcon} />
          <HeaderPill
            lang={targetLang}
            isOfflineReady={offlineStatus[targetLang]}
            onPress={() => openLanguageSelector('target')}
            side="right"
          />
        </View>

        {/* --- Translation Input and Output Cards --- */}
        <View style={styles.cardsContainer}>
          {/* Top Card (Input/Source) */}
          <View style={[styles.card, styles.topCard, Platform.OS === 'android' ? styles.cardAndroidShadow : null]}>
            <TextInput
              style={styles.textInput}
              multiline
              placeholder="Enter text..."
              placeholderTextColor="#999"
              value={inputText}
              onChangeText={setInputText}
              textAlignVertical="top"
              maxLength={1000}
            />
            {inputText.length > 0 && (
              <IconButton
                name="close"
                size={22}
                onPress={() => setInputText('')}
                style={styles.clearIcon}
              />
            )}
            {/* Input Bottom Actions (Volume, Mic) */}
            <View style={styles.cardBottomActions}>
              <IconButton name="volume-medium-outline" onPress={() => handleSpeak(inputText)} />
              <IconButton name="mic" size={30} onPress={handleMicPress} />
              <View style={styles.countContainer}>
                <Text style={styles.countText}>{inputText.length}/1000</Text>
              </View>
            </View>
          </View>

          {/* Bottom Card (Output/Target) */}
          <View style={[styles.card, styles.bottomCard, Platform.OS === 'android' ? styles.cardAndroidShadow : null]}>
            {isTranslating ? (
              <Text style={[styles.translatedText, { color: '#999' }]}>Translating...</Text>
            ) : (
              <Text style={styles.translatedText} selectable>
                {outputText}
              </Text>
            )}
            {/* Output Bottom Actions (Volume, Copy) */}
            <View style={styles.cardBottomActions}>
              <IconButton name="volume-medium-outline" onPress={() => handleSpeak(outputText)} />
              <IconButton name="content-copy" type="MaterialIcons" onPress={() => {}} />
            </View>
          </View>
        </View>

        {/* --- Bottom Sheet for Language Selection --- */}
        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose
          backdropComponent={renderBackdrop}
          backgroundStyle={styles.sheetBackground}
          handleIndicatorStyle={{ backgroundColor: '#ccc' }}
        >
          <BottomSheetView style={styles.sheetContent}>
            <Text style={styles.sheetHeader}>
              {selectingMode === 'source' ? 'Translate From' : 'Translate To'}
            </Text>
            {languageList.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={styles.sheetItem}
                onPress={() => handleLanguageSelect(lang.code)}
              >
                <Text
                  style={[
                    styles.sheetItemText,
                    (selectingMode === 'source' ? lang.code === sourceLang : lang.code === targetLang) && {
                      color: PRIMARY_BLUE,
                      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
                    },
                  ]}
                >
                  {lang.label}
                </Text>
                {(selectingMode === 'source' ? lang.code === sourceLang : lang.code === targetLang) && (
                  <MaterialIcons name="check" size={24} color={PRIMARY_BLUE} />
                )}
                {offlineStatus[lang.code] && (
                  <Ionicons name="checkmark-done-circle" size={18} color="#ccc" style={{ marginLeft: 8 }} />
                )}
              </TouchableOpacity>
            ))
          }
          </BottomSheetView>
        </BottomSheet>
      </View>
    </TouchableWithoutFeedback>
  );
};

// --- Full Stylesheet matching the provided UI/ux images ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_OFF_WHITE,
    paddingTop: Platform.OS === 'ios' ? 60 : 20, // Adjust for top notches
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    ...Platform.select({
      ios: {
        shadowColor: 'black',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerPill: {
    backgroundColor: 'rgba(26, 115, 232, 0.06)', // Subtly tinted blue
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  headerPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerPillText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  swapIcon: {
    marginHorizontal: 12,
    backgroundColor: 'transparent',
    padding: 8,
  },
  cardsContainer: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
      },
    }),
  },
  cardAndroidShadow: {
    elevation: 3,
  },
  topCard: {
    marginBottom: 12,
    flex: 3, // More space for input
    padding: 16,
  },
  bottomCard: {
    flex: 2, // Less space for output
    padding: 16,
    backgroundColor: BG_OFF_WHITE, // Matched the gray output box in the image
  },
  textInput: {
    flex: 1,
    fontSize: 26, // Large font matching the image
    lineHeight: 32,
    color: '#000',
    paddingBottom: 40, // Space for bottom actions
  },
  translatedText: {
    flex: 1,
    fontSize: 26,
    lineHeight: 32,
    color: '#000',
  },
  clearIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 6,
    backgroundColor: 'white',
    borderRadius: 20,
  },
  cardBottomActions: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countContainer: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  countText: {
    color: '#aaa',
    fontSize: 12,
  },
  iconButton: {
    padding: 10,
    borderRadius: 25,
    backgroundColor: 'transparent',
  },
  // Bottom Sheet Styles
  sheetBackground: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: 'white',
  },
  sheetContent: {
    padding: 24,
    paddingBottom: 40,
  },
  sheetHeader: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    color: ACCENT_COLOR,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  sheetItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sheetItemText: {
    fontSize: 18,
    color: '#333',
  },
});

export default CebuanoTranslatorScreen;