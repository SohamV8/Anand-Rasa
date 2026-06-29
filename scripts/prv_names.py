"""Indian name and city pools for patron review generation."""

NORTH_FIRST = [
    "Aarav", "Rohan", "Ananya", "Neha", "Kartik", "Priyanshi", "Aditya", "Ishita",
    "Harsh", "Kavita", "Tarun", "Divya", "Vivek", "Nidhi", "Arjun", "Meera",
    "Sameer", "Pallavi", "Devansh", "Shreya", "Kabir", "Ritu", "Manish", "Anjali",
]
NORTH_LAST = [
    "Sharma", "Verma", "Gupta", "Bansal", "Tyagi", "Jain", "Malhotra", "Khurana",
    "Saxena", "Chopra", "Bhatia", "Sood", "Luthra", "Sarin", "Kohli", "Wadhwa",
]

WEST_FIRST = [
    "Mihir", "Riddhi", "Harsh", "Krunal", "Priya", "Dhruv", "Tanvi", "Nisha",
    "Jayesh", "Sneha", "Raj", "Pooja", "Amit", "Bhavika", "Kunal", "Jignesh",
]
WEST_LAST = [
    "Patel", "Shah", "Mehta", "Desai", "Joshi", "Merchant", "Parekh", "Thakkar",
    "Modi", "Gandhi", "Doshi", "Bhatt", "Trivedi", "Naik", "Sanghvi", "Kapadia",
]

SOUTH_FIRST = [
    "Karthik", "Nithya", "Divya", "Arjun", "Sandeep", "Lakshmi", "Revathi", "Pranav",
    "Keerthi", "Harish", "Ananya", "Suresh", "Deepa", "Gopal", "Meenakshi", "Vignesh",
]
SOUTH_LAST = [
    "Iyer", "Raman", "Krishnan", "Nair", "Reddy", "Rao", "Pillai", "Menon",
    "Shetty", "Hegde", "Gowda", "Pai", "Nambiar", "Chettiar", "Sundaram", "Varma",
]

EAST_FIRST = [
    "Sayan", "Ananya", "Ritu", "Arindam", "Debjani", "Subhash", "Moumita", "Abhishek",
    "Priyanka", "Sourav", "Tanushree", "Indrani", "Rahul", "Sharmila", "Bikash", "Mitali",
]
EAST_LAST = [
    "Banerjee", "Chatterjee", "Das", "Ghosh", "Bose", "Mukherjee", "Sen", "Roy",
    "Dutta", "Bhattacharya", "Mitra", "Kar", "Pal", "Sarkar", "Ganguly", "Basu",
]

CENTRAL_FIRST = [
    "Rahul", "Pooja", "Aman", "Snehal", "Nitin", "Radhika", "Mohit", "Swati",
    "Akash", "Preeti", "Vikram", "Jyoti", "Lalit", "Uma", "Bharat", "Chitra",
]
CENTRAL_LAST = [
    "Pandey", "Mishra", "Yadav", "Dubey", "Trivedi", "Shukla", "Agarwal", "Singh",
    "Rathore", "Chauhan", "Jha", "Srivastava", "Verma", "Patel", "Kulkarni", "Desai",
]

EXTRA_FIRST = [
    "Ayaan", "Ishaan", "Vihaan", "Myra", "Kiara", "Vivaan", "Anika", "Reyansh",
    "Saanvi", "Advait", "Diya", "Atharv", "Navya", "Arnav", "Ira", "Shaurya",
    "Zoya", "Rudra", "Avni", "Parth", "Sia", "Yash", "Maya", "Dhruv",
    "Tara", "Rehan", "Amaira", "Veer", "Kyra", "Shivansh", "Aadhya", "Krish",
]
EXTRA_LAST = [
    "Bhardwaj", "Goyal", "Handa", "Mittal", "Grover", "Chadha", "Saluja", "Bhasin",
    "Talwar", "Ahluwalia", "Bedekar", "Kakkar", "Monga", "Sethi", "Bajwa", "Brar",
    "Chawla", "Dewan", "Gokhale", "Hazra", "Inamdar", "Jhaveri", "Kakade", "Lamba",
]

CITIES = [
    "Jaipur", "Delhi", "Mumbai", "Bengaluru", "Chennai", "Hyderabad", "Kolkata", "Pune",
    "Ahmedabad", "Lucknow", "Kochi", "Chandigarh", "Indore", "Bhopal", "Surat", "Nagpur",
    "Vadodara", "Mysuru", "Coimbatore", "Madurai", "Thiruvananthapuram", "Guwahati",
    "Dehradun", "Haridwar", "Rishikesh", "Varanasi", "Udaipur", "Jodhpur", "Amritsar",
    "Shimla", "Panaji", "Visakhapatnam", "Patna", "Ranchi", "Bhubaneswar", "Gurgaon",
    "Noida", "Faridabad", "Srinagar", "Agra", "Kanpur", "Nashik", "Aurangabad",
    "Kolhapur", "Belagavi", "Hubballi", "Siliguri", "Darjeeling", "Gangtok", "Raipur",
    "Meerut", "Thrissur", "Mangalore", "Cuttack", "Jamshedpur", "Allahabad", "Gwalior",
    "Tiruchirappalli", "Warangal", "Mysore", "Aligarh", "Moradabad", "Bareilly",
    "Salem", "Vellore", "Erode", "Tirupati", "Guntur", "Rajkot", "Jamnagar",
    "Bhavnagar", "Ujjain", "Jabalpur", "Dhanbad", "Asansol", "Durgapur", "Howrah",
    "Malappuram", "Kozhikode", "Kannur", "Palakkad", "Kottayam", "Alappuzha",
    "Ajmer", "Kota", "Bikaner", "Alwar", "Hisar", "Rohtak", "Sonipat", "Ludhiana",
    "Jalandhar", "Patiala", "Bathinda", "Mohali", "Panipat", "Karnal", "Ambala",
    "Solapur", "Sangli", "Satara", "Latur", "Akola", "Nanded", "Amravati",
    "Bilaspur", "Raigarh", "Durg", "Bhilai", "Sambalpur", "Rourkela", "Puri",
    "Shillong", "Imphal", "Aizawl", "Agartala", "Itanagar", "Kohima", "Gangtok",
]

DATES = [
    "3 days ago", "5 days ago", "1 week ago", "10 days ago", "2 weeks ago",
    "18 days ago", "3 weeks ago", "1 month ago", "5 weeks ago", "6 weeks ago",
    "7 weeks ago", "2 months ago", "9 weeks ago", "10 weeks ago", "3 months ago",
    "11 weeks ago", "4 months ago", "5 months ago", "6 months ago",
]

def build_name_pairs():
    pairs = []
    regions = [
        (NORTH_FIRST, NORTH_LAST),
        (WEST_FIRST, WEST_LAST),
        (SOUTH_FIRST, SOUTH_LAST),
        (EAST_FIRST, EAST_LAST),
        (CENTRAL_FIRST, CENTRAL_LAST),
        (EXTRA_FIRST, EXTRA_LAST),
        (NORTH_FIRST, WEST_LAST),
        (SOUTH_FIRST, EAST_LAST),
        (WEST_FIRST, NORTH_LAST),
        (EAST_FIRST, SOUTH_LAST),
    ]
    seen = set()
    for firsts, lasts in regions:
        for f in firsts:
            for l in lasts:
                name = f"{f} {l}"
                if name not in seen:
                    seen.add(name)
                    pairs.append(name)
    return pairs

NAME_PAIRS = build_name_pairs()
