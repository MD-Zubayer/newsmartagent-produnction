TARGET_KEYWORDS =[
             'প্রয়োজন', 'প্রয়োজন', 'লাগবে', 'দরকার', 'কিনতে চাই', 
            'বললে ভাল হত', 'জানালে ভালো হতো', 'জানান', 'বলেন', 'আবেদন',
            'নিতে চাই', 'খুঁজছি', 'price please', 'আছে কি', 'চাই', 'বাজেট', 'অ্যাভেইলঅ্যাবল', 'অ্যাভেলেবল', 'স্টক', 'অর্ডার',
             'দাম কত', 'মূল্য কত', 'কোথায় পাব', 'ঠিকানা', 'লোকেশন',
            'ডেলিভারি', 'কুরিয়ার', 'শপ', 'দোকান', 'কালার', 'সাইজ',
             'ডিসকাউন্ট', 'অফার', 'পাব কি', 'পাওয়া যাবে', 'নিতে পারবো',
            'বিস্তারিত', 'ডিটেইলস', 'details', 'available', 'location',
            'delivery', 'inbox', 'ইনবক্স', 'মেসেজ', 'বুকিং','price', 'cost', 'how much', 'want to buy', 'need', 'available', 
            'stock', 'available ki', 'ache ki', 'lagbe', 'dorkar', 'kinte chai',
            'details please', 'info', 'specification', 'delivery', 'courier',
            'discount', 'offer', 'budget', 'location', 'address', 'shop', 
            'where to find', 'can i get', 'order', 'booking', 'inbox', 
            'send photo', 'real picture', 'original', 'warranty', 'guarantee',
            'color', 'size', 'model', 'brand', 'low price', 'cheap', 'best',
]

embedding_skip_keyword = [
    # --- বাংলা (BN) ---
    'হাই', 'হ্যালো', 'কেমন আছেন', 'ভালো', 'শুভ সকাল', 'শুভ রাত্রি', 'ধন্যবাদ', 'সরি', 
    'কি খবর', 'ঠিক আছি', 'ভাল আছি', 'আসসালামু আলাইকুম', 'ঠিক আছে', 'ধন্যবাদ ভাই', 
    'শুভ দিন', 'শুভ সকাল ভাই', 'শুভ রাত্রি ভাই', 'ভাই কেমন', 'ভালো লাগল', 'ধন্যবাদ দাদা',
    'মাফ করবেন', 'দুঃখিত', 'ধন্যবাদ বন্ধু', 'ভাই ভালো আছেন?', 'ভাল লাগল', 'শুভ অপরাহ্ন', 'শুভ সন্ধ্যা', 'কেমন চলছে', 'ভাই কেমন আছেন', 'সুপ্রভাত',

    # --- English (EN) ---
    'hi', 'hello', 'hey', 'yo', 'wassup', 'good morning', 'good night', 'morning', 'night', 
    'hi bro', 'hello friend', 'thanks', 'thank you', 'ok', 'okk', 'sorry', 'welcome', 'good day', 'good evening',

    # --- Banglish / Mix (BN+EN) ---
    'kemon aso', 'bhalo aso', 'ki khabar', 'dhonnobad', 'shubho sokal', 'shubho ratri', 
    'valo achi', 'ami bhalo', 'ki khobor bro', 'thik achi', 'bhalo achi', 'assalamualaikum', 
    'shuvo din', 'shuvo sokal', 'shuvo ratri', 'valo laglo', 'dhonnobad bro', 'bhalo laglo', 'kemon aso bhai'
]