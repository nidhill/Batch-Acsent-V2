// Static state/city data for the two regions ba_regions currently has (India, UAE) — used to
// cascade Student Admission's State (from Region) and City (suggestions, from State) instead
// of three unrelated free-text fields that let "Kerala"/"kerala"/"KL" all get typed for the
// same state. Kept local rather than pulling in a country-state-city package: only two
// countries are ever selected here, so a small hand-maintained list is lighter and doesn't
// depend on an external service being up. City lists aren't exhaustive — the City field stays
// a free-text input with these as <datalist> suggestions, so an admission is never blocked by
// a town missing from the list.

export const STATES_BY_REGION: Record<string, string[]> = {
    India: [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
        'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
        'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
        'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
        'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
        'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
        'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
    ],
    'UAE (Dubai)': [
        'Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah',
    ],
}

// District/city suggestions — thorough for Kerala (the academy's home state and the bulk of
// admissions), lighter elsewhere. Free-text entry always still works for anything not listed.
export const CITIES_BY_STATE: Record<string, string[]> = {
    Kerala: [
        'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam', 'Idukki',
        'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad',
        'Kannur', 'Kasaragod',
    ],
    Karnataka: ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi', 'Kalaburagi'],
    'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli'],
    Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Thane'],
    Delhi: ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi'],
    Telangana: ['Hyderabad', 'Warangal', 'Nizamabad'],
    'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati'],
    'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Noida', 'Agra', 'Varanasi', 'Ghaziabad'],
    'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri'],
    Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'],
    Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota'],
    Punjab: ['Chandigarh', 'Ludhiana', 'Amritsar', 'Jalandhar'],
    Dubai: ['Dubai', 'Deira', 'Jumeirah', 'Al Barsha'],
    'Abu Dhabi': ['Abu Dhabi City', 'Al Ain'],
    Sharjah: ['Sharjah City'],
}
