

export type CommandGroup = {
  display: string;
  reply: {
    en?: string;
    te?: string;
    hi?: string;
    en_audio?: string;
    te_audio?: string;
    hi_audio?: string;
  } | string;
};

// Rewritten replies to be more conversational and varied.
export const generalCommands: Record<string, CommandGroup> = {
    'home': { 
        display: 'Go Home', 
        reply: {
            en: 'Going to the home page.,Okay, heading home.,Right away!',
            te: 'హోమ్ పేజీకి వెళ్తున్నాను.,సరే, ఇంటికి వెళ్తున్నాను.',
            hi: 'होम पेज पर जा रहा हूँ।,ठीक है, घर जा रहा हूँ।'
        }
    },
    'stores': { 
        display: 'Browse Stores', 
        reply: {
            en: 'Here are all the nearby stores.,Showing all available stores for you.,Let\'s find you a great local store.',
            te: 'ఇక్కడ సమీపంలోని అన్ని దుకాణాలు ఉన్నాయి.,మీ కోసం అందుబాటులో ఉన్న అన్ని దుకాణాలను చూపిస్తున్నాను.',
            hi: 'यहाँ पास की सभी दुकानें हैं।,आपके लिए सभी उपलब्ध दुकानें दिखा रहा हूँ।'
        }
    },
    'dashboard': { 
        display: 'Go To Dashboard', 
        reply: {
            en: 'Opening your dashboard now.,Here is your dashboard.',
            te: 'మీ డాష్‌బోర్డ్‌ను ఇప్పుడు తెరుస్తున్నాను.,ఇదిగో మీ డాష్‌బోర్డ్.',
            hi: 'अब आपका डैशबोर्ड खोल रहा हूँ।,यहाँ आपका डैशबोर्ड है।'
        }
    },
    'cart': { 
        display: 'Show Cart', 
        reply: {
            en: 'Here\'s what\'s in your cart.,Opening your shopping cart.',
            te: 'మీ కార్ట్‌లో ఉన్నవి ఇక్కడ ఉన్నాయి.,మీ షాపింగ్ కార్ట్‌ను తెరుస్తున్నాను.',
            hi: 'आपकी कार्ट में क्या है, यहाँ देखें।,आपकी शॉपिंग कार्ट खोल रहा हूँ।'
        }
    },
    'orders': { 
        display: 'My Orders', 
        reply: {
            en: 'Here are your past orders.,Opening your order history.',
            te: 'మీ గత ఆర్డర్లు ఇక్కడ ఉన్నాయి.,మీ ఆర్డర్ చరిత్రను తెరుస్తున్నాను.',
            hi: 'आपके पिछले ऑर्डर यहाँ हैं।,आपका ऑर्डर इतिहास खोल रहा हूँ।'
        }
    },
    'deliveries': { 
        display: 'My Deliveries', 
        reply: {
            en: 'Opening the delivery partner dashboard.,Here are your delivery jobs.',
            te: 'డెలివరీ పార్టనర్ డాష్‌బోర్డ్‌ను తెరుస్తున్నాను.,మీ డెలివరీ పనులు ఇక్కడ ఉన్నాయి.',
            hi: 'डिलीवरी पार्टनर डैशबोर्ड खोल रहा हूँ।,आपके डिलीवरी कार्य यहाँ हैं।'
        }
    },
    'myStore': { 
        display: 'My Store', 
        reply: {
            en: 'Opening your store management page.,Let\'s take a look at your store.',
            te: 'మీ స్టోర్ నిర్వహణ పేజీని తెరుస్తున్నాను.,మీ స్టోర్‌ను చూద్దాం.',
            hi: 'आपका स्टोर प्रबंधन पृष्ठ खोल रहा हूँ।,चलिए आपके स्टोर पर एक नज़र डालते हैं।'
        }
    },
    'myProfile': { 
        display: 'My Profile', 
        reply: {
            en: 'Here is your profile information.,Opening your profile for you to edit.',
            te: 'మీ ప్రొఫైల్ సమాచారం ఇక్కడ ఉంది.,సవరించడానికి మీ ప్రొఫైల్‌ను తెరుస్తున్నాను.',
            hi: 'आपकी प्रोफ़ाइल जानकारी यहाँ है।,संपादित करने के लिए आपकी प्रोफ़ाइल खोल रहा हूँ।'
        }
    },
     'managePacks': {
        display: 'Manage Packs',
        reply: {
            en: 'Opening the pack management page.',
            te: 'ప్యాక్ నిర్వహణ పేజీని తెరుస్తున్నాను.',
            hi: 'पैक प्रबंधन पृष्ठ खोल रहा हूँ।'
        }
    },
    'recipe-tester': {
        display: 'Recipe Tester',
        reply: {
            en: 'Opening the AI recipe tester.',
            te: 'AI రెసిపీ టెస్టర్‌ను తెరుస్తున్నాను.',
            hi: 'AI रेसिपी टेस्टर खोल रहा हूँ।'
        }
    },
    'checkout': { 
        display: 'Proceed to Checkout', 
        reply: {
            en: 'Okay, let\'s complete your order.',
            te: 'సరే, మీ ఆర్డర్‌ను పూర్తి చేద్దాం.',
            hi: 'ठीक है, चलिए आपका ऑर्डर पूरा करते हैं।'
        }
    },
    'placeOrder': { 
        display: 'Place Order', 
        reply: {
            en: 'Placing your order now. Thank you!,Order placed! We\'ll notify you with updates.',
            te: 'మీ ఆర్డర్‌ను ఇప్పుడు ప్లేస్ చేస్తున్నాను. ధన్యవాదాలు!,ఆర్డర్ ప్లేస్ చేయబడింది! మేము మీకు అప్‌డేట్‌లతో తెలియజేస్తాము.',
            hi: 'अब आपका ऑर्डर दे रहा हूँ। धन्यवाद!,ऑर्डर दे दिया गया है! हम आपको अपडेट के साथ सूचित करेंगे।'
        }
    },
    'saveChanges': { 
        display: 'Save Changes', 
        reply: {
            en: 'Got it. Saving your changes.,Okay, everything is saved.',
            te: 'అర్థమైంది. మీ మార్పులను సేవ్ చేస్తున్నాను.,సరే, అంతా సేవ్ చేయబడింది.',
            hi: 'समझ गया। आपके बदलाव सहेज रहा हूँ।,ठीक है, सब कुछ सहेज लिया गया है।'
        }
    },
    'recordOrder': { 
        display: 'Record a Voice Order', 
        reply: {
            en: 'I\'m ready. Please list the items you want to order.',
            te: 'నేను సిద్ధంగా ఉన్నాను. దయచేసి మీరు ఆర్డర్ చేయాలనుకుంటున్న వస్తువుల జాబితాను చెప్పండి.',
            hi: 'मैं तैयार हूँ। कृपया उन वस्तुओं की सूची बनाएँ जिन्हें आप ऑर्डर करना चाहते हैं।'
        }
    },
    'checkPrice': { 
        display: 'Check Price', 
        reply: {
            en: 'Sure, which item\'s price do you want to check?',
            te: 'తప్పకుండా, మీరు ఏ వస్తువు ధరను తనిఖీ చేయాలనుకుంటున్నారు?',
            hi: 'ज़रूर, आप किस वस्तु की कीमत जाँचना चाहते हैं?'
        }
    },
    'refresh': { 
        display: 'Refresh Page', 
        reply: {
            en: 'Refreshing the page now.,Okay, let\'s get a fresh look.',
            te: 'పేజీని ఇప్పుడు రిఫ్రెష్ చేస్తున్నాను.,సరే, ఒక కొత్త లుక్ చూద్దాం.',
            hi: 'अब पृष्ठ को रीफ्रेश कर रहा हूँ।,ठीक है, चलिए एक नया रूप देखते हैं।'
        }
    },
    'acceptDeliveryJob': { 
        display: 'Accept Delivery Job', 
        reply: {
            en: 'Great! This delivery job has been assigned to you. Happy driving!,Got it! You\'re all set to go.',
            te: 'చాలా మంచిది! ఈ డెలివరీ పని మీకు కేటాయించబడింది. సంతోషంగా డ్రైవ్ చేయండి!,అర్థమైంది! మీరు వెళ్ళడానికి సిద్ధంగా ఉన్నారు.',
            hi: 'बढ़िया! यह डिलीवरी कार्य आपको सौंपा गया है। हैप्पी ड्राइविंग!,समझ गया! आप जाने के लिए पूरी तरह तैयार हैं।'
        }
    },
    'showDetails': {
        display: 'Show Details',
        reply: {
            en: 'Showing details for the first item.',
            te: 'మొదటి అంశం కోసం వివరాలను చూపిస్తున్నాను.',
            hi: 'पहले आइटम के लिए विवरण दिखा रहा हूँ।'
        }
    },
    'get-recipe': {
        display: 'Get Recipe Ingredients',
        reply: {
            en: 'Sure, for which dish would you like the ingredients?',
            te: 'తప్పకుండా, మీకు ఏ వంటకం కోసం కావలసిన పదార్థాలు కావాలి?',
            hi: 'ज़रूर, आप किस व्यंजन के लिए सामग्री चाहते हैं?'
        }
    },
    'homeAddress': { 
        display: 'Use Home Address', 
        reply: {
            en: 'Setting delivery to your home address.',
            te: 'మీ ఇంటి చిరునామాకు డెలివరీని సెట్ చేస్తున్నాను.',
            hi: 'आपके घर के पते पर डिलीवरी सेट कर रहा हूँ।'
        }
    },
    'currentLocation': { 
        display: 'Use Current Location', 
        reply: {
            en: 'Using your current location for delivery.',
            te: 'డెలివరీ కోసం మీ ప్రస్తుత స్థానాన్ని ఉపయోగిస్తున్నాను.',
            hi: 'डिलीवरी के लिए आपके वर्तमान स्थान का उपयोग कर रहा हूँ।'
        }
    },
    'installApp': {
        display: 'Install App',
        reply: {
            en: 'Opening the app installation page.,Here is the QR code to install the app.',
            te: 'యాప్ ఇన్‌స్టాలేషన్ పేజీని తెరుస్తున్నాను.,యాప్‌ను ఇన్‌స్టాల్ చేయడానికి QR కోడ్ ఇక్కడ ఉంది.',
            hi: 'ऐप इंस्टॉलेशन पेज खोल रहा हूँ।,ऐप इंस्टॉल करने के लिए QR कोड यहाँ है।'
        }
    },
    'help': { 
        display: 'Help / Commands', 
        reply: {
            en: 'You can say things like "order 1 kilo of onions", "go to my cart", "check price of tomatoes", or "find stores near me". What would you like to do?',
            te: 'మీరు "1 కిలో ఉల్లిపాయలు ఆర్డర్ చేయండి", "నా కార్ట్‌కు వెళ్లండి", "టమోటాల ధరను తనిఖీ చేయండి", లేదా "నా దగ్గర ఉన్న దుకాణాలను కనుగొనండి" వంటివి చెప్పవచ్చు. మీరు ఏమి చేయాలనుకుంటున్నారు?',
            hi: 'आप "1 किलो प्याज ऑर्डर करें", "मेरी कार्ट में जाएँ", "टमाटर की कीमत जाँचें", या "मेरे पास की दुकानें खोजें" जैसी बातें कह सकते हैं। आप क्या करना चाहेंगे?'
        }
    },
    'who-are-you': { 
        display: 'Who Are You?', 
        reply: {
            en: 'I am the LocalBasket voice assistant, here to make your grocery shopping faster and easier. Now we are using AI.',
            te: 'నేను లోకల్‌బాస్కెట్ వాయిస్ అసిస్టెంట్‌ని, మీ కిరాణా షాపింగ్‌ను వేగంగా మరియు సులభంగా చేయడానికి ఇక్కడ ఉన్నాను. ఇప్పుడు మేము AIని ఉపయోగిస్తున్నాము.',
            hi: 'मैं लोकलबास्केट वॉयस असिस्टेंट हूँ, जो आपकी किराने की खरीदारी को तेज़ और आसान बनाने के लिए यहाँ है। अब हम AI का उपयोग कर रहे हैं।'
        }
    },
    'how-it-works': { 
        display: 'How It Works', 
        reply: {
            en: 'Just tell me what you want to order, which store you want it from, and where to deliver it. I will handle the rest!',
            te: 'మీరు ఏమి ఆర్డర్ చేయాలనుకుంటున్నారో, ఏ స్టోర్ నుండి కావాలో, మరియు ఎక్కడికి డెలివరీ చేయాలో నాకు చెప్పండి. మిగిలినది నేను చూసుకుంటాను!',
            hi: 'बस मुझे बताएं कि आप क्या ऑर्डर करना चाहते हैं, किस स्टोर से चाहते हैं, और कहाँ डिलीवर करना है। बाकी मैं संभाल लूँगा!'
        }
    },
    'addItem': {
        display: 'Add Item to Cart',
        reply: {
            en: "Okay, I've added {quantity} {weight} of {productName} to your cart.",
            te: 'సరే, నేను మీ కార్ట్‌కి {quantity} {weight} {productName} జోడించాను.',
            hi: 'ठीक है, मैंने आपकी कार्ट में {productName} का {quantity} {weight} जोड़ दिया है।'
        }
    }
};
