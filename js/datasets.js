/**
 * ATLAS — curated word banks
 *
 * Every entry is: [WORD, emoji, note?]
 *  - WORD  canonical uppercase display name (normalized on load)
 *  - emoji the "iconic" art shown on the card
 *  - note  short caption (place/region/year); falls back to the category blurb
 *
 * Works both in the browser (window.AtlasData) and in Node (module.exports)
 * so the engine can be unit-tested without a DOM.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AtlasData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var CATEGORIES = {
    PLACES: {
      label: "Places",
      blurb: "Landmarks & wonders",
      glyph: "\u25C8",
      entries: [
        ["AFRICA", "\uD83C\uDF0D", "Continent"],
        ["ASIA", "\uD83C\uDF0F", "Continent"],
        ["EUROPE", "\uD83C\uDF0D", "Continent"],
        ["AMERICA", "\uD83C\uDF0E", "Continent"],
        ["NORTH AMERICA", "\uD83C\uDF0E", "Continent"],
        ["SOUTH AMERICA", "\uD83C\uDF0E", "Continent"],
        ["ANTARCTICA", "\uD83E\uDDCA", "Continent"],
        ["OCEANIA", "\uD83C\uDF0A", "Region"],
        ["TAJ MAHAL", "\uD83D\uDD4C", "Agra, India"],
        ["EIFFEL TOWER", "\uD83D\uDDFC", "Paris, France"],
        ["GREAT WALL OF CHINA", "\uD83C\uDFEF", "China"],
        ["MACHU PICCHU", "\u26F0\uFE0F", "Peru"],
        ["COLOSSEUM", "\uD83C\uDFDB\uFE0F", "Rome, Italy"],
        ["PETRA", "\uD83C\uDFDC\uFE0F", "Jordan"],
        ["CHICHEN ITZA", "\uD83D\uDED5", "Mexico"],
        ["PYRAMIDS OF GIZA", "\uD83D\uDD3A", "Egypt"],
        ["STATUE OF LIBERTY", "\uD83D\uDDFD", "New York, USA"],
        ["SYDNEY OPERA HOUSE", "\uD83C\uDFAD", "Australia"],
        ["BURJ KHALIFA", "\uD83C\uDFD9\uFE0F", "Dubai, UAE"],
        ["BIG BEN", "\uD83D\uDD54", "London, UK"],
        ["TOWER BRIDGE", "\uD83C\uDF09", "London, UK"],
        ["STONEHENGE", "\uD83E\uDEA8", "England"],
        ["ANGKOR WAT", "\uD83D\uDEEB\uFE0F", "Cambodia"],
        ["GOLDEN TEMPLE", "\uD83D\uDD49\uFE0F", "Amritsar, India"],
        ["TAJ LAKE", "\uD83D\uDCA7", "India"],
        ["HIMALAYAS", "\uD83C\uDFD4\uFE0F", "Asia"],
        ["MOUNT EVEREST", "\uD83D\uDDFB", "Nepal & China"],
        ["KILIMANJARO", "\uD83C\uDF0B", "Tanzania"],
        ["ANDES", "\u26F0\uFE0F", "South America"],
        ["ALPS", "\uD83C\uDFD4\uFE0F", "Europe"],
        ["ROCKIES", "\uD83C\uDFD4\uFE0F", "North America"],
        ["SAHARA", "\uD83C\uDFDC\uFE0F", "Africa"],
        ["GOBI", "\uD83C\uDFDC\uFE0F", "Asia"],
        ["AMAZON", "\uD83C\uDF3F", "South America"],
        ["NIAGARA FALLS", "\uD83D\uDCA6", "Canada & USA"],
        ["VICTORIA FALLS", "\uD83D\uDCA6", "Zambia & Zimbabwe"],
        ["IGUAZU FALLS", "\uD83D\uDCA6", "Brazil & Argentina"],
        ["GRAND CANYON", "\uD83C\uDFDE\uFE0F", "Arizona, USA"],
        ["DEAD SEA", "\uD83C\uDF0A", "Jordan & Israel"],
        ["RED SEA", "\uD83C\uDF0A", "Egypt & Arabia"],
        ["BLACK SEA", "\uD83C\uDF0A", "Europe & Asia"],
        ["CASPIAN SEA", "\uD83C\uDF0A", "Asia & Europe"],
        ["MEDITERRANEAN SEA", "\uD83C\uDF0A", "Europe & Africa"],
        ["PACIFIC OCEAN", "\uD83C\uDF0A", "Pacific"],
        ["ATLANTIC OCEAN", "\uD83C\uDF0A", "Atlantic"],
        ["INDIAN OCEAN", "\uD83C\uDF0A", "Indian"],
        ["ARCTIC OCEAN", "\uD83E\uDDCA", "Arctic"],
        ["GREAT BARRIER REEF", "\uD83D\uDC20", "Australia"],
        ["MALDIVES", "\uD83C\uDFDD\uFE0F", "Indian Ocean"],
        ["SANTORINI", "\uD83C\uDFD8\uFE0F", "Greece"],
        ["BALI", "\uD83C\uDF34", "Indonesia"],
        ["IBIZA", "\uD83C\uDF1E", "Spain"],
        ["TAHITI", "\uD83C\uDF34", "French Polynesia"],
        ["HAWAII", "\uD83C\uDF34", "USA"],
        ["GREENLAND", "\uD83E\uDDCA", "North America"],
        ["MADAGASCAR", "\uD83E\uDD81", "Africa"],
        ["SERENGETI", "\uD83E\uDD81", "Tanzania"],
        ["KRUGER", "\uD83D\uDC18", "South Africa"],
        ["EVERGLADES", "\uD83D\uDC0A", "Florida, USA"],
        ["YELLOWSTONE", "\uD83C\uDF0B", "Wyoming, USA"],
        ["MACHU PICCHU TRAIL", "\uD83E\uDD7E", "Peru"],
        ["ULURU", "\uD83E\uDEA8", "Australia"],
        ["MOUNT FUJI", "\uD83D\uDDFB", "Japan"],
        ["MOUNT KENYA", "\uD83D\uDDFB", "Kenya"],
        ["TABLE MOUNTAIN", "\u26F0\uFE0F", "Cape Town"],
        ["VESUVIUS", "\uD83C\uDF0B", "Italy"],
        ["ETNA", "\uD83C\uDF0B", "Sicily"],
        ["HALONG BAY", "\uD83D\uDEA2", "Vietnam"],
        ["THAMES", "\uD83C\uDF09", "London"],
        ["SEINE", "\uD83D\uDEA2", "Paris"],
        ["NILE", "\uD83D\uDEA2", "Africa"],
        ["AMAZON RIVER", "\uD83D\uDEA2", "South America"],
        ["GANGES", "\uD83D\uDEA2", "India"],
        ["BROADWAY", "\uD83C\uDFAD", "New York"],
        ["HOLLYWOOD", "\uD83C\uDFAC", "Los Angeles"],
        ["WESTMINSTER", "\uD83C\uDFDB\uFE0F", "London"],
        ["PARTHENON", "\uD83C\uDFDB\uFE0F", "Athens"],
        ["ACROPOLIS", "\uD83C\uDFDB\uFE0F", "Athens"],
        ["FORBIDDEN CITY", "\uD83C\uDFEF", "Beijing"],
        ["BRANDENBURG GATE", "\uD83C\uDFDB\uFE0F", "Berlin"],
        ["SAGRADA FAMILIA", "\u26EA", "Barcelona"],
        ["LEANING TOWER OF PISA", "\uD83C\uDFDB\uFE0F", "Italy"],
        ["NEUSCHWANSTEIN", "\uD83C\uDFF0", "Germany"],
        ["ALHAMBRA", "\uD83C\uDFF0", "Spain"],
        ["HAGIA SOPHIA", "\uD83D\uDD4C", "Istanbul"],
        ["BLUE MOSQUE", "\uD83D\uDD4C", "Istanbul"],
        ["KHAJURAHO", "\uD83D\uDD4C", "India"],
        ["HAMPI", "\uD83D\uDEEB\uFE0F", "India"],
        ["JAISALMER", "\uD83C\uDFDC\uFE0F", "Rajasthan, India"],
        ["JAIPUR", "\uD83C\uDFF0", "Rajasthan, India"],
        ["UDAIPUR", "\uD83D\uDEE0\uFE0F", "Rajasthan, India"],
        ["VARANASI", "\uD83D\uDD6F\uFE0F", "Uttar Pradesh, India"],
        ["KERALA", "\uD83D\uDEF6", "India"],
        ["LADAKH", "\uD83C\uDFD4\uFE0F", "India"],
        ["ANDAMAN", "\uD83C\uDF34", "India"],
        ["EVEREST BASE CAMP", "\uD83C\uDFD5\uFE0F", "Nepal"],
        ["SOSSUSVLEI", "\uD83C\uDFDC\uFE0F", "Namibia"],
        ["ATACAMA", "\uD83C\uDFDC\uFE0F", "Chile"],
        ["PATAGONIA", "\uD83C\uDFD4\uFE0F", "South America"],
        ["ICELAND", "\uD83C\uDF0B", "Nordic"],
        ["NORTHERN LIGHTS", "\uD83C\uDF0C", "Polar skies"],
        ["VENEZIA", "\uD83D\uDE82", "Italy"],
        ["POMPEII", "\uD83C\uDFDB\uFE0F", "Italy"],
        ["TROMSO", "\u2744\uFE0F", "Norway"],
        ["BANFF", "\uD83C\uDFD4\uFE0F", "Canada"],
        ["YOSEMITE", "\uD83C\uDFD4\uFE0F", "California"],
        ["ZERMATT", "\u26F0\uFE0F", "Switzerland"],
        ["INTERLAKEN", "\uD83D\uDEA3", "Switzerland"],
        ["OKAVANGO", "\uD83D\uDC18", "Botswana"],
        ["OAHU", "\uD83C\uDF34", "Hawaii, USA"],
        ["OREGON", "\uD83C\uDF32", "USA"],
        ["QUEENSTOWN", "\u26F0\uFE0F", "New Zealand"],
        ["QUEENSLAND", "\uD83E\uDD98", "Australia"],
        ["QUTUB MINAR", "\uD83D\uDD4C", "Delhi, India"],
        ["XANADU", "\uD83C\uDFEF", "Legendary city"],
        ["XIAN", "\uD83C\uDFEF", "China"]
      ]
    },

    CITIES: {
      label: "Cities",
      blurb: "Cities of the world",
      glyph: "\u25A3",
      entries: [
        ["AGRA", "\uD83D\uDD4C", "India"],
        ["AHMEDABAD", "\uD83C\uDFEF", "India"],
        ["AMSTERDAM", "\uD83D\uDEB2", "Netherlands"],
        ["ATHENS", "\uD83C\uDFDB\uFE0F", "Greece"],
        ["AUCKLAND", "\u26F5", "New Zealand"],
        ["BANGKOK", "\uD83D\uDEEB\uFE0F", "Thailand"],
        ["BARCELONA", "\uD83C\uDFD6\uFE0F", "Spain"],
        ["BEIJING", "\uD83C\uDFEF", "China"],
        ["BERLIN", "\uD83C\uDFDB\uFE0F", "Germany"],
        ["BHOPAL", "\uD83C\uDFDE\uFE0F", "India"],
        ["BHUBNESWAR", "\uD83D\uDD4C", "Odisha, India"],
        ["BOGOTA", "\uD83C\uDFD4\uFE0F", "Colombia"],
        ["BOSTON", "\uD83C\uDFEB", "USA"],
        ["BRUSSELS", "\uD83C\uDFD6\uFE0F", "Belgium"],
        ["BUDAPEST", "\uD83C\uDF09", "Hungary"],
        ["CAIRO", "\uD83D\uDD3A", "Egypt"],
        ["CAPE TOWN", "\u26F0\uFE0F", "South Africa"],
        ["CHANDIGARH", "\uD83C\uDF33", "India"],
        ["CHENNAI", "\uD83C\uDFD6\uFE0F", "India"],
        ["CHICAGO", "\uD83C\uDFD9\uFE0F", "USA"],
        ["COPENHAGEN", "\uD83D\uDEB2", "Denmark"],
        ["DALLAS", "\uD83E\uDD20", "USA"],
        ["DELHI", "\uD83C\uDFEF", "India"],
        ["DHARAMSALA", "\uD83C\uDFD4\uFE0F", "India"],
        ["DOHA", "\uD83C\uDFD9\uFE0F", "Qatar"],
        ["DUBAI", "\uD83C\uDFD9\uFE0F", "UAE"],
        ["DUBLIN", "\uD83C\uDF7A", "Ireland"],
        ["EDINBURGH", "\uD83C\uDFF0", "Scotland"],
        ["FLORENCE", "\uD83C\uDFDB\uFE0F", "Italy"],
        ["FRANKFURT", "\uD83C\uDFE6", "Germany"],
        ["GENEVA", "\u231A", "Switzerland"],
        ["GOA", "\uD83C\uDF34", "India"],
        ["GURUGRAM", "\uD83C\uDFD9\uFE0F", "India"],
        ["HAMBURG", "\u2693", "Germany"],
        ["HANOI", "\uD83C\uDF5C", "Vietnam"],
        ["HAVANA", "\uD83C\uDFB8", "Cuba"],
        ["HELSINKI", "\u2744\uFE0F", "Finland"],
        ["HONG KONG", "\uD83C\uDFD9\uFE0F", "China"],
        ["HONOLULU", "\uD83C\uDF34", "USA"],
        ["HYDERABAD", "\uD83C\uDF5B", "India"],
        ["INDORE", "\uD83C\uDF6C", "India"],
        ["ISTANBUL", "\uD83D\uDD4C", "Turkey"],
        ["JAIPUR", "\uD83C\uDFF0", "India"],
        ["JAKARTA", "\uD83C\uDFD9\uFE0F", "Indonesia"],
        ["JERUSALEM", "\uD83D\uDD4C", "Israel"],
        ["JODHPUR", "\uD83C\uDFD6\uFE0F", "India"],
        ["JOHANNESBURG", "\u26CF\uFE0F", "South Africa"],
        ["KANPUR", "\uD83C\uDFED", "India"],
        ["KOCHI", "\uD83D\uDEF6", "India"],
        ["KOLKATA", "\uD83C\uDF09", "India"],
        ["KUALA LUMPUR", "\uD83C\uDFD9\uFE0F", "Malaysia"],
        ["KYOTO", "\u26E9\uFE0F", "Japan"],
        ["LAGOS", "\uD83C\uDFB6", "Nigeria"],
        ["LIMA", "\uD83C\uDF5B", "Peru"],
        ["LISBON", "\uD83D\uDE8B", "Portugal"],
        ["LONDON", "\uD83C\uDFA1", "UK"],
        ["LOS ANGELES", "\uD83C\uDFAC", "USA"],
        ["LUCKNOW", "\uD83D\uDD4C", "India"],
        ["MADRID", "\uD83C\uDFD6\uFE0F", "Spain"],
        ["MADRAS", "\uD83C\uDFD6\uFE0F", "India"],
        ["MANILA", "\uD83C\uDFD9\uFE0F", "Philippines"],
        ["MELBOURNE", "\u2615", "Australia"],
        ["MEXICO CITY", "\uD83C\uDF2E\uFE0F", "Mexico"],
        ["MIAMI", "\uD83C\uDF34", "USA"],
        ["MILAN", "\uD83D\uDC57", "Italy"],
        ["MONTREAL", "\uD83C\uDF41", "Canada"],
        ["MOSCOW", "\uD83C\uDFDB\uFE0F", "Russia"],
        ["MUMBAI", "\uD83C\uDFD9\uFE0F", "India"],
        ["MUNICH", "\uD83C\uDF7A", "Germany"],
        ["MYSORE", "\uD83C\uDFF0", "India"],
        ["NAIROBI", "\uD83E\uDD81", "Kenya"],
        ["NAGPUR", "\uD83C\uDF43", "India"],
        ["NEW YORK", "\uD83D\uDDFD", "USA"],
        ["NICE", "\uD83C\uDFD6\uFE0F", "France"],
        ["OSAKA", "\uD83C\uDF63", "Japan"],
        ["OSLO", "\u26F0\uFE0F", "Norway"],
        ["PARIS", "\uD83D\uDDFC", "France"],
        ["PATNA", "\uD83C\uDFEF", "India"],
        ["PRAGUE", "\uD83C\uDFF0", "Czechia"],
        ["PUNE", "\uD83C\uDFEB", "India"],
        ["QUEBEC", "\uD83C\uDFF0", "Canada"],
        ["REYKJAVIK", "\uD83C\uDF0B", "Iceland"],
        ["RIO DE JANEIRO", "\uD83C\uDFAD", "Brazil"],
        ["ROME", "\uD83C\uDFDB\uFE0F", "Italy"],
        ["SAN FRANCISCO", "\uD83C\uDF09", "USA"],
        ["SANTIAGO", "\uD83C\uDFD4\uFE0F", "Chile"],
        ["SAO PAULO", "\uD83C\uDFD9\uFE0F", "Brazil"],
        ["SEATTLE", "\u2615", "USA"],
        ["SEOUL", "\uD83C\uDFD9\uFE0F", "South Korea"],
        ["SHANGHAI", "\uD83C\uDFD9\uFE0F", "China"],
        ["SINGAPORE", "\uD83E\uDD81", "Singapore"],
        ["STOCKHOLM", "\uD83C\uDFD6\uFE0F", "Sweden"],
        ["SURAT", "\uD83D\uDC8E", "India"],
        ["SYDNEY", "\uD83C\uDF0A", "Australia"],
        ["TAIPEI", "\uD83C\uDFD9\uFE0F", "Taiwan"],
        ["THIRUVANANTHAPURAM", "\uD83D\uDEEB\uFE0F", "India"],
        ["TOKYO", "\uD83D\uDDFE", "Japan"],
        ["TORONTO", "\uD83C\uDFD9\uFE0F", "Canada"],
        ["UDAIPUR", "\uD83D\uDEE0\uFE0F", "India"],
        ["VANCOUVER", "\uD83C\uDF32", "Canada"],
        ["VARANASI", "\uD83D\uDD6F\uFE0F", "India"],
        ["VENICE", "\uD83D\uDE82", "Italy"],
        ["VIENNA", "\uD83C\uDFB5", "Austria"],
        ["WARSAW", "\uD83C\uDFDB\uFE0F", "Poland"],
        ["WASHINGTON", "\uD83C\uDFDB\uFE0F", "USA"],
        ["XIAMEN", "\uD83C\uDF0A", "China"],
        ["YOKOHAMA", "\u2693", "Japan"],
        ["ZURICH", "\uD83D\uDCB0", "Switzerland"]
      ]
    },

    COUNTRIES: {
      label: "Countries",
      blurb: "Nations of the world",
      glyph: "\u25CE",
      entries: [
        ["AFGHANISTAN", "\uD83C\uDDE6\uD83C\uDDEB"],
        ["ALBANIA", "\uD83C\uDDE6\uD83C\uDDF1"],
        ["ALGERIA", "\uD83C\uDDE9\uD83C\uDDFF"],
        ["ANDORRA", "\uD83C\uDDE6\uD83C\uDDE9"],
        ["ANGOLA", "\uD83C\uDDE6\uD83C\uDDF4"],
        ["ARGENTINA", "\uD83C\uDDE6\uD83C\uDDF7"],
        ["ARMENIA", "\uD83C\uDDE6\uD83C\uDDF2"],
        ["AUSTRALIA", "\uD83C\uDDE6\uD83C\uDDFA"],
        ["AUSTRIA", "\uD83C\uDDE6\uD83C\uDDF9"],
        ["AZERBAIJAN", "\uD83C\uDDE6\uD83C\uDDFF"],
        ["BAHAMAS", "\uD83C\uDDE7\uD83C\uDDF8"],
        ["BAHRAIN", "\uD83C\uDDE7\uD83C\uDDED"],
        ["BANGLADESH", "\uD83C\uDDE7\uD83C\uDDE9"],
        ["BARBADOS", "\uD83C\uDDE7\uD83C\uDDE7"],
        ["BELARUS", "\uD83C\uDDE7\uD83C\uDDFE"],
        ["BELGIUM", "\uD83C\uDDE7\uD83C\uDDEA"],
        ["BELIZE", "\uD83C\uDDE7\uD83C\uDDFF"],
        ["BENIN", "\uD83C\uDDE7\uD83C\uDDEF"],
        ["BHUTAN", "\uD83C\uDDE7\uD83C\uDDF9"],
        ["BOLIVIA", "\uD83C\uDDE7\uD83C\uDDF4"],
        ["BOTSWANA", "\uD83C\uDDE7\uD83C\uDDFC"],
        ["BRAZIL", "\uD83C\uDDE7\uD83C\uDDF7"],
        ["BRUNEI", "\uD83C\uDDE7\uD83C\uDDF3"],
        ["BULGARIA", "\uD83C\uDDE7\uD83C\uDDEC"],
        ["CAMBODIA", "\uD83C\uDDF0\uD83C\uDDED"],
        ["CAMEROON", "\uD83C\uDDE8\uD83C\uDDF2"],
        ["CANADA", "\uD83C\uDDE8\uD83C\uDDE6"],
        ["CHAD", "\uD83C\uDDF9\uD83C\uDDE9"],
        ["CHILE", "\uD83C\uDDE8\uD83C\uDDF1"],
        ["CHINA", "\uD83C\uDDE8\uD83C\uDDF3"],
        ["COLOMBIA", "\uD83C\uDDE8\uD83C\uDDF4"],
        ["COSTA RICA", "\uD83C\uDDE8\uD83C\uDDF7"],
        ["CROATIA", "\uD83C\uDDED\uD83C\uDDF7"],
        ["CUBA", "\uD83C\uDDE8\uD83C\uDDFA"],
        ["CYPRUS", "\uD83C\uDDE8\uD83C\uDDFE"],
        ["CZECHIA", "\uD83C\uDDE8\uD83C\uDDFF"],
        ["DENMARK", "\uD83C\uDDE9\uD83C\uDDF0"],
        ["ECUADOR", "\uD83C\uDDEA\uD83C\uDDE8"],
        ["EGYPT", "\uD83C\uDDEA\uD83C\uDDEC"],
        ["ESTONIA", "\uD83C\uDDEA\uD83C\uDDEA"],
        ["ETHIOPIA", "\uD83C\uDDEA\uD83C\uDDF9"],
        ["FIJI", "\uD83C\uDDEB\uD83C\uDDEF"],
        ["FINLAND", "\uD83C\uDDEB\uD83C\uDDEE"],
        ["FRANCE", "\uD83C\uDDEB\uD83C\uDDF7"],
        ["GABON", "\uD83C\uDDEC\uD83C\uDDE6"],
        ["GERMANY", "\uD83C\uDDE9\uD83C\uDDEA"],
        ["GHANA", "\uD83C\uDDEC\uD83C\uDDED"],
        ["GREECE", "\uD83C\uDDEC\uD83C\uDDF7"],
        ["GUATEMALA", "\uD83C\uDDEC\uD83C\uDDF9"],
        ["GUINEA", "\uD83C\uDDEC\uD83C\uDDF3"],
        ["GUYANA", "\uD83C\uDDEC\uD83C\uDDFE"],
        ["HAITI", "\uD83C\uDDED\uD83C\uDDF9"],
        ["HONDURAS", "\uD83C\uDDED\uD83C\uDDF3"],
        ["HUNGARY", "\uD83C\uDDED\uD83C\uDDFA"],
        ["ICELAND", "\uD83C\uDDEE\uD83C\uDDF8"],
        ["INDIA", "\uD83C\uDDEE\uD83C\uDDF3"],
        ["INDONESIA", "\uD83C\uDDEE\uD83C\uDDE9"],
        ["IRAN", "\uD83C\uDDEE\uD83C\uDDF7"],
        ["IRAQ", "\uD83C\uDDEE\uD83C\uDDF6"],
        ["IRELAND", "\uD83C\uDDEE\uD83C\uDDEA"],
        ["ISRAEL", "\uD83C\uDDEE\uD83C\uDDF1"],
        ["ITALY", "\uD83C\uDDEE\uD83C\uDDF9"],
        ["JAMAICA", "\uD83C\uDDEF\uD83C\uDDF2"],
        ["JAPAN", "\uD83C\uDDEF\uD83C\uDDF5"],
        ["JORDAN", "\uD83C\uDDEF\uD83C\uDDF4"],
        ["KAZAKHSTAN", "\uD83C\uDDF0\uD83C\uDDFF"],
        ["KENYA", "\uD83C\uDDF0\uD83C\uDDEA"],
        ["KUWAIT", "\uD83C\uDDF0\uD83C\uDDFC"],
        ["KYRGYZSTAN", "\uD83C\uDDF0\uD83C\uDDEC"],
        ["LAOS", "\uD83C\uDDF1\uD83C\uDDE6"],
        ["LATVIA", "\uD83C\uDDF1\uD83C\uDDFB"],
        ["LEBANON", "\uD83C\uDDF1\uD83C\uDDE7"],
        ["LIBERIA", "\uD83C\uDDF1\uD83C\uDDF7"],
        ["LIBYA", "\uD83C\uDDF1\uD83C\uDDFE"],
        ["LITHUANIA", "\uD83C\uDDF1\uD83C\uDDF9"],
        ["LUXEMBOURG", "\uD83C\uDDF1\uD83C\uDDFA"],
        ["MADAGASCAR", "\uD83C\uDDF2\uD83C\uDDEC"],
        ["MALAYSIA", "\uD83C\uDDF2\uD83C\uDDFE"],
        ["MALDIVES", "\uD83C\uDDF2\uD83C\uDDFB"],
        ["MALI", "\uD83C\uDDF2\uD83C\uDDF1"],
        ["MALTA", "\uD83C\uDDF2\uD83C\uDDF9"],
        ["MAURITIUS", "\uD83C\uDDF2\uD83C\uDDFA"],
        ["MEXICO", "\uD83C\uDDF2\uD83C\uDDFD"],
        ["MONACO", "\uD83C\uDDF2\uD83C\uDDE8"],
        ["MONGOLIA", "\uD83C\uDDF2\uD83C\uDDF3"],
        ["MONTENEGRO", "\uD83C\uDDF2\uD83C\uDDEA"],
        ["MOROCCO", "\uD83C\uDDF2\uD83C\uDDE6"],
        ["MOZAMBIQUE", "\uD83C\uDDF2\uD83C\uDDFF"],
        ["MYANMAR", "\uD83C\uDDF2\uD83C\uDDF2"],
        ["NAMIBIA", "\uD83C\uDDF3\uD83C\uDDE6"],
        ["NEPAL", "\uD83C\uDDF3\uD83C\uDDF5"],
        ["NETHERLANDS", "\uD83C\uDDF3\uD83C\uDDF1"],
        ["NEW ZEALAND", "\uD83C\uDDF3\uD83C\uDDFF"],
        ["NICARAGUA", "\uD83C\uDDF3\uD83C\uDDEE"],
        ["NIGER", "\uD83C\uDDF3\uD83C\uDDEA"],
        ["NIGERIA", "\uD83C\uDDF3\uD83C\uDDEC"],
        ["NORWAY", "\uD83C\uDDF3\uD83C\uDDF4"],
        ["OMAN", "\uD83C\uDDF4\uD83C\uDDF2"],
        ["PAKISTAN", "\uD83C\uDDF5\uD83C\uDDF0"],
        ["PANAMA", "\uD83C\uDDF5\uD83C\uDDE6"],
        ["PARAGUAY", "\uD83C\uDDF5\uD83C\uDDFE"],
        ["PERU", "\uD83C\uDDF5\uD83C\uDDEA"],
        ["PHILIPPINES", "\uD83C\uDDF5\uD83C\uDDED"],
        ["POLAND", "\uD83C\uDDF5\uD83C\uDDF1"],
        ["PORTUGAL", "\uD83C\uDDF5\uD83C\uDDF9"],
        ["QATAR", "\uD83C\uDDF6\uD83C\uDDE6"],
        ["ROMANIA", "\uD83C\uDDF7\uD83C\uDDF4"],
        ["RUSSIA", "\uD83C\uDDF7\uD83C\uDDFA"],
        ["RWANDA", "\uD83C\uDDF7\uD83C\uDDFC"],
        ["SAUDI ARABIA", "\uD83C\uDDF8\uD83C\uDDE6"],
        ["SENEGAL", "\uD83C\uDDF8\uD83C\uDDF3"],
        ["SERBIA", "\uD83C\uDDF8\uD83C\uDDF7"],
        ["SINGAPORE", "\uD83C\uDDF8\uD83C\uDDEC"],
        ["SLOVAKIA", "\uD83C\uDDF8\uD83C\uDDF0"],
        ["SLOVENIA", "\uD83C\uDDF8\uD83C\uDDEE"],
        ["SOMALIA", "\uD83C\uDDF8\uD83C\uDDF4"],
        ["SOUTH AFRICA", "\uD83C\uDDFF\uD83C\uDDE6"],
        ["SOUTH KOREA", "\uD83C\uDDF0\uD83C\uDDF7"],
        ["SPAIN", "\uD83C\uDDEA\uD83C\uDDF8"],
        ["SRI LANKA", "\uD83C\uDDF1\uD83C\uDDF0"],
        ["SUDAN", "\uD83C\uDDF8\uD83C\uDDE9"],
        ["SWEDEN", "\uD83C\uDDF8\uD83C\uDDEA"],
        ["SWITZERLAND", "\uD83C\uDDE8\uD83C\uDDED"],
        ["SYRIA", "\uD83C\uDDF8\uD83C\uDDFE"],
        ["TAIWAN", "\uD83C\uDDF9\uD83C\uDDFC"],
        ["TANZANIA", "\uD83C\uDDF9\uD83C\uDDFF"],
        ["THAILAND", "\uD83C\uDDF9\uD83C\uDDED"],
        ["TUNISIA", "\uD83C\uDDF9\uD83C\uDDF3"],
        ["TURKEY", "\uD83C\uDDF9\uD83C\uDDF7"],
        ["UGANDA", "\uD83C\uDDFA\uD83C\uDDEC"],
        ["UKRAINE", "\uD83C\uDDFA\uD83C\uDDE6"],
        ["URUGUAY", "\uD83C\uDDFA\uD83C\uDDFE"],
        ["UZBEKISTAN", "\uD83C\uDDFA\uD83C\uDDFF"],
        ["VANUATU", "\uD83C\uDDFB\uD83C\uDDFA"],
        ["VENEZUELA", "\uD83C\uDDFB\uD83C\uDDEA"],
        ["VIETNAM", "\uD83C\uDDFB\uD83C\uDDF3"],
        ["YEMEN", "\uD83C\uDDFE\uD83C\uDDEA"],
        ["ZAMBIA", "\uD83C\uDDFF\uD83C\uDDF2"],
        ["ZIMBABWE", "\uD83C\uDDFF\uD83C\uDDFC"]
      ]
    },

    MOVIES: {
      label: "Movies",
      blurb: "Cinema classics",
      glyph: "\u25B6",
      entries: [
        ["ALIEN", "\uD83D\uDC7D", "1979"],
        ["AMELIE", "\uD83C\uDFE1", "2001"],
        ["AVATAR", "\uD83C\uDF3F", "2009"],
        ["BATMAN", "\uD83E\uDD87", "1989"],
        ["BEN HUR", "\uD83D\uDEE1\uFE0F", "1959"],
        ["BLADE RUNNER", "\uD83C\uDF06", "1982"],
        ["BRAVEHEART", "\u2694\uFE0F", "1995"],
        ["CASABLANCA", "\uD83D\uDE2C", "1942"],
        ["CHICAGO", "\uD83C\uDFB7", "2002"],
        ["DUNE", "\uD83C\uDFDC\uFE0F", "2021"],
        ["FARGO", "\u2744\uFE0F", "1996"],
        ["FIGHT CLUB", "\uD83E\uDD4A", "1999"],
        ["FORREST GUMP", "\uD83C\uDFC3", "1994"],
        ["GLADIATOR", "\uD83D\uDDE1\uFE0F", "2000"],
        ["GOODFELLAS", "\uD83C\uDFB2", "1990"],
        ["GRAVITY", "\uD83D\uDE80", "2013"],
        ["HEAT", "\uD83D\uDD25", "1995"],
        ["HER", "\uD83D\uDC9B", "2013"],
        ["INCEPTION", "\uD83C\uDF00", "2010"],
        ["INTERSTELLAR", "\uD83E\uDE90", "2014"],
        ["JAWS", "\uD83E\uDD88", "1975"],
        ["JOKER", "\uD83C\uDFAD", "2019"],
        ["JURASSIC PARK", "\uD83E\uDD96", "1993"],
        ["KILL BILL", "\uD83D\uDDE1\uFE0F", "2003"],
        ["LA LA LAND", "\uD83C\uDFB9", "2016"],
        ["LION KING", "\uD83E\uDD81", "1994"],
        ["MEMENTO", "\uD83D\uDD0E", "2000"],
        ["METROPOLIS", "\uD83C\uDFD9\uFE0F", "1927"],
        ["OPPENHEIMER", "\uD83D\uDCA5", "2023"],
        ["PARASITE", "\uD83C\uDFE0", "2019"],
        ["PSYCHO", "\uD83D\uDEBF", "1960"],
        ["PULP FICTION", "\uD83C\uDF54", "1994"],
        ["RAN", "\uD83C\uDFF0", "1985"],
        ["ROCKY", "\uD83E\uDD4A", "1976"],
        ["SCARFACE", "\uD83D\uDCB0", "1983"],
        ["SEVEN", "\uD83D\uDD11", "1995"],
        ["SHREK", "\uD83D\uDC79", "2001"],
        ["SIGNS", "\uD83C\uDF3E", "2002"],
        ["STAR WARS", "\uD83C\uDF0C", "1977"],
        ["TENET", "\u231B", "2020"],
        ["TERMINATOR", "\uD83E\uDD16", "1984"],
        ["THE BATMAN", "\uD83E\uDD87", "2022"],
        ["THE GODFATHER", "\uD83C\uDFAF", "1972"],
        ["THE MATRIX", "\uD83D\uDD77\uFE0F", "1999"],
        ["THE SHINING", "\uD83D\uDEAA", "1980"],
        ["TITANIC", "\uD83D\uDEA2", "1997"],
        ["TOP GUN", "\u2708\uFE0F", "1986"],
        ["TOY STORY", "\uD83E\uDDF8", "1995"],
        ["TROY", "\uD83D\uDC0E", "2004"],
        ["UP", "\uD83C\uDF88", "2009"],
        ["VERTIGO", "\uD83C\uDF00", "1958"],
        ["WALL E", "\uD83E\uDD16", "2008"],
        ["WHIPLASH", "\uD83E\uDD41", "2014"],
        ["WONDER WOMAN", "\uD83D\uDEE1\uFE0F", "2017"],
        ["X MEN", "\u274C", "2000"],
        ["ZODIAC", "\u2648", "2007"],
        ["ARRIVAL", "\uD83D\uDEF8", "2016"],
        ["BIRDMAN", "\uD83D\uDC26", "2014"],
        ["CARS", "\uD83D\uDE97", "2006"],
        ["COCO", "\uD83C\uDFB8", "2017"],
        ["DRIVE", "\uD83D\uDE98", "2011"],
        ["ELF", "\uD83C\uDF84", "2003"],
        ["FROZEN", "\u2744\uFE0F", "2013"],
        ["GHOST", "\uD83D\uDC7B", "1990"],
        ["HOME ALONE", "\uD83C\uDFE0", "1990"],
        ["ICE AGE", "\uD83E\uDDCA", "2002"],
        ["JAILHOUSE ROCK", "\uD83C\uDFB8", "1957"],
        ["KING KONG", "\uD83E\uDD8D", "1933"],
        ["LITTLE WOMEN", "\uD83D\uDCDA", "2019"],
        ["MOANA", "\uD83C\uDF0A", "2016"],
        ["NEMO", "\uD83D\uDC20", "2003"],
        ["OCEANS ELEVEN", "\uD83C\uDFB0", "2001"],
        ["PINOCCHIO", "\uD83E\uDEB5", "1940"],
        ["RATATOUILLE", "\uD83D\uDC00", "2007"],
        ["SHARK TALE", "\uD83E\uDD88", "2004"],
        ["TANGLED", "\uD83E\uDC8F", "2010"],
        ["VERTICAL LIMIT", "\u26F0\uFE0F", "2000"],
        ["WANTED", "\uD83C\uDFAF", "2008"],
        ["YES MAN", "\uD83D\uDE04", "2008"],
        ["ZOOLANDER", "\uD83D\uDD77\uFE0F", "2001"],
        ["ROCKY II", "\uD83E\uDD4A", "1979"],
        ["PARIS TEXAS", "\uD83C\uDFDC\uFE0F", "1984"],
        ["ANNIE HALL", "\uD83C\uDFAC", "1977"],
        ["BIG", "\uD83C\uDFAE", "1988"],
        ["CABIRIA", "\uD83C\uDFDB\uFE0F", "1914"],
        ["DUNKIRK", "\uD83D\uDEA2", "2017"],
        ["E.T.", "\uD83D\uDC7D", "1982"],
        ["FANTASIA", "\uD83C\uDFB5", "1940"],
        ["GANDHI", "\uD83D\uDD4C", "1982"],
        ["HITCH", "\uD83D\uDC98", "2005"],
        ["INSIDE OUT", "\uD83E\uDDE0", "2015"],
        ["JAWS 2", "\uD83E\uDD88", "1978"],
        ["KRISH", "\uD83E\uDD87", "2006"],
        ["LAGAAN", "\uD83C\uDFCF", "2001"],
        ["MOTHER INDIA", "\uD83C\uDF3E", "1957"],
        ["NAYAK", "\uD83D\uDC51", "1966"],
        ["OM SHANTI OM", "\uD83C\uDFAD", "2007"],
        ["PK", "\uD83D\uDEF8", "2014"],
        ["QUEEN", "\uD83D\uDC78", "2014"],
        ["RAIN MAN", "\uD83D\uDE97", "1988"],
        ["SHOLAY", "\uD83D\uDC0E", "1975"],
        ["TAARE ZAMEEN PAR", "\u2B50", "2007"],
        ["URI", "\uD83C\uDF96\uFE0F", "2019"],
        ["VEER ZAARA", "\uD83D\uDC9E", "2004"],
        ["WAR", "\uD83D\uDCA5", "2019"],
        ["ZINDAGI NA MILEGI DOBARA", "\uD83C\uDFD6\uFE0F", "2011"]
      ]
    },

    ANIMALS: {
      label: "Animals",
      blurb: "Wild & wonderful",
      glyph: "\u25D1",
      entries: [
        ["ALLIGATOR", "\uD83D\uDC0A"], ["ALPACA", "\uD83E\uDD99"], ["ANTELOPE", "\uD83E\uDD8C"],
        ["BEAR", "\uD83D\uDC3B"], ["BEAVER", "\uD83E\uDDAB"], ["BISON", "\uD83E\uDDAC"],
        ["CAMEL", "\uD83D\uDC2B"], ["CAPYBARA", "\uD83E\uDDAB"], ["CAT", "\uD83D\uDC31"],
        ["CHAMELEON", "\uD83E\uDD8E"], ["CHEETAH", "\uD83D\uDC06"], ["CHIMPANZEE", "\uD83D\uDC12"],
        ["COUGAR", "\uD83D\uDC06"], ["COW", "\uD83D\uDC2E"], ["CRAB", "\uD83E\uDD80"],
        ["CROCODILE", "\uD83D\uDC0A"], ["DEER", "\uD83E\uDD8C"], ["DODO", "\uD83D\uDC26"],
        ["DOG", "\uD83D\uDC36"], ["DOLPHIN", "\uD83D\uDC2C"], ["DONKEY", "\uD83E\uDDAC"],
        ["DUCK", "\uD83E\uDD86"], ["EAGLE", "\uD83E\uDD85"], ["EEL", "\uD83D\uDC1F"],
        ["ELEPHANT", "\uD83D\uDC18"], ["ELK", "\uD83E\uDD8C"], ["EMU", "\uD83E\uDDA9"],
        ["FALCON", "\uD83E\uDD85"], ["FERRET", "\uD83E\uDDAB"], ["FLAMINGO", "\uD83E\uDDA9"],
        ["FOX", "\uD83E\uDD8A"], ["FROG", "\uD83D\uDC38"], ["GAZELLE", "\uD83E\uDD8C"],
        ["GIRAFFE", "\uD83E\uDD92"], ["GOAT", "\uD83D\uDC10"], ["GORILLA", "\uD83E\uDD8D"],
        ["HAMSTER", "\uD83D\uDC39"], ["HARE", "\uD83D\uDC07"], ["HEDGEHOG", "\uD83E\uDD94"],
        ["HIPPO", "\uD83E\uDD9B"], ["HORSE", "\uD83D\uDC34"], ["HYENA", "\uD83D\uDC3A"],
        ["IBIS", "\uD83E\uDDA9"], ["IGUANA", "\uD83E\uDD8E"], ["IMPALA", "\uD83E\uDD8C"],
        ["JACKAL", "\uD83D\uDC3A"], ["JAGUAR", "\uD83D\uDC06"], ["JELLYFISH", "\uD83E\uDD90"],
        ["KANGAROO", "\uD83E\uDD98"], ["KOALA", "\uD83D\uDC28"], ["KRILL", "\uD83E\uDD90"],
        ["LEMUR", "\uD83D\uDC12"], ["LEOPARD", "\uD83D\uDC06"], ["LION", "\uD83E\uDD81"],
        ["LLAMA", "\uD83E\uDD99"], ["LOBSTER", "\uD83E\uDD9E"], ["LYNX", "\uD83D\uDC08"],
        ["MANATEE", "\uD83E\uDD9D"], ["MEERKAT", "\uD83E\uDD8C"], ["MONKEY", "\uD83D\uDC12"],
        ["MOOSE", "\uD83E\uDD8C"], ["MOSQUITO", "\uD83E\uDD9F"], ["MOUSE", "\uD83D\uDC01"],
        ["NARWHAL", "\uD83D\uDC0B"], ["NEWT", "\uD83E\uDD8E"], ["NIGHTINGALE", "\uD83D\uDC26"],
        ["OCTOPUS", "\uD83D\uDC19"], ["OKAPI", "\uD83E\uDD8C"], ["OSTRICH", "\uD83E\uDDA9"],
        ["OTTER", "\uD83E\uDD9D"], ["OWL", "\uD83E\uDD89"], ["OX", "\uD83D\uDC02"],
        ["PANDA", "\uD83D\uDC3C"], ["PANTHER", "\uD83D\uDC06"], ["PARROT", "\uD83E\uDD9C"],
        ["PEACOCK", "\uD83E\uDD9A"], ["PELICAN", "\uD83E\uDDA9"], ["PENGUIN", "\uD83D\uDC27"],
        ["PIG", "\uD83D\uDC16"], ["PLATYPUS", "\uD83E\uDDAB"], ["PORCUPINE", "\uD83E\uDD94"],
        ["QUAIL", "\uD83D\uDC26"], ["QUOKKA", "\uD83D\uDC28"], ["RABBIT", "\uD83D\uDC07"],
        ["RACCOON", "\uD83E\uDD9D"], ["RAM", "\uD83D\uDC0F"], ["RAT", "\uD83D\uDC00"],
        ["REINDEER", "\uD83E\uDD8C"], ["RHINO", "\uD83E\uDD8F"], ["ROBIN", "\uD83D\uDC26"],
        ["SALAMANDER", "\uD83E\uDD8E"], ["SEAL", "\uD83E\uDDAD"], ["SHARK", "\uD83E\uDD88"],
        ["SHEEP", "\uD83D\uDC11"], ["SLOTH", "\uD83E\uDD9B"], ["SNAKE", "\uD83D\uDC0D"],
        ["SPIDER", "\uD83D\uDD78\uFE0F"], ["SQUID", "\uD83E\uDD91"], ["SQUIRREL", "\uD83D\uDC3F\uFE0F"],
        ["SWAN", "\uD83E\uDD9A"], ["TAPIR", "\uD83E\uDD8C"], ["TIGER", "\uD83D\uDC05"],
        ["TOAD", "\uD83D\uDC38"], ["TORTOISE", "\uD83D\uDC22"], ["TURKEY", "\uD83E\uDD83"],
        ["TURTLE", "\uD83D\uDC22"], ["URCHIN", "\uD83E\uDD90"], ["VULTURE", "\uD83E\uDDA9"],
        ["WALRUS", "\uD83E\uDDAD"], ["WASP", "\uD83D\uDC1D"], ["WHALE", "\uD83D\uDC33"],
        ["WOLF", "\uD83D\uDC3A"], ["WOMBAT", "\uD83D\uDC28"], ["WOODPECKER", "\uD83D\uDC26"],
        ["XERUS", "\uD83D\uDC3F\uFE0F"], ["YAK", "\uD83D\uDC02"], ["ZEBRA", "\uD83E\uDD93"],
        ["ZEBU", "\uD83D\uDC02"]
      ]
    },

    FOOD: {
      label: "Food",
      blurb: "Eat your way around",
      glyph: "\u25CF",
      entries: [
        ["APPLE", "\uD83C\uDF4E"], ["AVOCADO", "\uD83E\uDD51"], ["BAGEL", "\uD83E\uDD6F"],
        ["BAKLAVA", "\uD83C\uDF6F"], ["BANANA", "\uD83C\uDF4C"], ["BIRYANI", "\uD83C\uDF5B"],
        ["BREAD", "\uD83C\uDF5E"], ["BURGER", "\uD83C\uDF54"], ["BURRITO", "\uD83C\uDF2F\uFE0F"],
        ["CAKE", "\uD83C\uDF70"], ["CALZONE", "\uD83E\uDD67"], ["CHEESE", "\uD83E\uDDC0"],
        ["CHICKEN", "\uD83C\uDF57"], ["CHOCOLATE", "\uD83C\uDF6B"], ["COOKIE", "\uD83C\uDF6A"],
        ["CROISSANT", "\uD83E\uDD50"], ["CURRY", "\uD83C\uDF5B"], ["DONUT", "\uD83C\uDF69"],
        ["DUMPLINGS", "\uD83E\uDD5F"], ["ECLAIR", "\uD83C\uDF6B"], ["ENCHILADA", "\uD83C\uDF2F\uFE0F"],
        ["FALAFEL", "\uD83E\uDDC6"], ["FISH", "\uD83D\uDC1F"], ["FRIES", "\uD83C\uDF5F"],
        ["GELATO", "\uD83C\uDF66"], ["GNOCCHI", "\uD83E\uDD5F"], ["GUACAMOLE", "\uD83E\uDD51"],
        ["HOTDOG", "\uD83C\uDF2D"], ["HUMMUS", "\uD83E\uDDC6"], ["ICE CREAM", "\uD83C\uDF66"],
        ["JALEBI", "\uD83C\uDF69"], ["JAM", "\uD83C\uDF53"], ["KEBAB", "\uD83E\uDD56"],
        ["KETCHUP", "\uD83C\uDF45"], ["KIMCHI", "\uD83E\uDD6C"], ["LASAGNA", "\uD83C\uDF5D"],
        ["LEMON", "\uD83C\uDF4B"], ["LHASSI", "\uD83E\uDD5B"], ["MANGO", "\uD83E\uDD6D"],
        ["MILK", "\uD83E\uDD5B"], ["MOCHI", "\uD83C\uDF61"], ["MUFFIN", "\uD83E\uDDC1"],
        ["NACHOS", "\uD83C\uDF2E\uFE0F"], ["NAAN", "\uD83E\uDD56"], ["NOODLES", "\uD83C\uDF5C"],
        ["OLIVES", "\uD83E\uDED2"], ["OMELET", "\uD83C\uDF73"], ["ONION", "\uD83E\uDDC5"],
        ["PANCAKE", "\uD83E\uDD5E"], ["PAELLA", "\uD83E\uDD58"], ["PASTA", "\uD83C\uDF5D"],
        ["PAVLOVA", "\uD83C\uDF70"], ["PIZZA", "\uD83C\uDF55"], ["POPCORN", "\uD83C\uDF7F"],
        ["PRETZEL", "\uD83E\uDD68"], ["QUICHE", "\uD83E\uDD67"], ["QUINOA", "\uD83C\uDF3E"],
        ["RAMEN", "\uD83C\uDF5C"], ["RAVIOLI", "\uD83E\uDD5F"], ["RISOTTO", "\uD83C\uDF5A"],
        ["SALAD", "\uD83E\uDD57"], ["SANDWICH", "\uD83E\uDD6A"], ["SASHIMI", "\uD83C\uDF63"],
        ["SOUP", "\uD83C\uDF72"], ["SPAGHETTI", "\uD83C\uDF5D"], ["STEAK", "\uD83E\uDD69"],
        ["SUSHI", "\uD83C\uDF63"], ["TACOS", "\uD83C\uDF2E\uFE0F"], ["TEA", "\uD83C\uDF75"],
        ["TOAST", "\uD83C\uDF5E"], ["TOFU", "\uD83E\uDDC8"], ["TOMATO", "\uD83C\uDF45"],
        ["UPMA", "\uD83C\uDF5A"], ["UDON", "\uD83C\uDF5C"], ["VADA", "\uD83E\uDD5F"],
        ["VANILLA", "\uD83C\uDF66"], ["WAFFLES", "\uD83E\uDDC7"], ["WATER", "\uD83D\uDCA7"],
        ["YOGURT", "\uD83E\uDD5B"], ["YAM", "\uD83C\uDF60"], ["ZUCCHINI", "\uD83E\uDD52"],
        ["ZEST", "\uD83C\uDF4B"]
      ]
    }
  };

  // Extra accepted spellings that do not get their own card.
  var ALIASES = {
    COUNTRIES: { USA: "UNITED STATES", US: "UNITED STATES", UK: "UNITED KINGDOM",
      UAE: "UNITED ARAB EMIRATES", HOLLAND: "NETHERLANDS", "CZECH REPUBLIC": "CZECHIA" },
    CITIES: { BOMBAY: "MUMBAI", MADRAS: "CHENNAI", CALCUTTA: "KOLKATA", BENGALURU: "BANGALORE" },
    MOVIES: { "THE MATRIX RELOADED": "THE MATRIX", "WALL-E": "WALL E", ET: "E.T." }
  };

  // Some countries/cities that only make sense as extra aliases above.
  CATEGORIES.COUNTRIES.entries.push(
    ["UNITED STATES", "\uD83C\uDDFA\uD83C\uDDF8"],
    ["UNITED KINGDOM", "\uD83C\uDDEC\uD83C\uDDE7"],
    ["UNITED ARAB EMIRATES", "\uD83C\uDDE6\uD83C\uDDEA"],
    ["NORTH KOREA", "\uD83C\uDDF0\uD83C\uDDF5"],
    ["EL SALVADOR", "\uD83C\uDDF8\uD83C\uDDFB"],
    ["COSTA RICA", "\uD83C\uDDE8\uD83C\uDDF7"]
  );

  var ordered = Object.keys(CATEGORIES);

  function normalize(value) {
    if (!value) return "";
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\u2019']/g, "")
      .replace(/[^A-Za-z0-9\s-]/g, " ")
      .replace(/[\s-]+/g, " ")
      .trim()
      .toUpperCase();
  }

  function firstLetter(word) {
    var clean = normalize(word);
    for (var i = 0; i < clean.length; i++) {
      if (clean[i] >= "A" && clean[i] <= "Z") return clean[i];
    }
    return "";
  }

  function lastLetter(word) {
    var clean = normalize(word);
    for (var i = clean.length - 1; i >= 0; i--) {
      if (clean[i] >= "A" && clean[i] <= "Z") return clean[i];
    }
    return "";
  }

  // Build lookup tables once.
  var INDEX = {};
  ordered.forEach(function (key) {
    var cat = CATEGORIES[key];
    var map = {};
    cat.entries.forEach(function (row) {
      var norm = normalize(row[0]);
      if (!norm) return;
      if (!map[norm]) {
        map[norm] = { word: row[0], norm: norm, emoji: row[1] || "", note: row[2] || cat.blurb, category: key };
      }
    });
    Object.keys(ALIASES[key] || {}).forEach(function (alias) {
      var target = map[normalize(ALIASES[key][alias])];
      if (target && !map[normalize(alias)]) map[normalize(alias)] = target;
    });
    cat.map = map;
    cat.words = Object.keys(map);
    cat.byLetter = {};
    cat.words.forEach(function (w) {
      var l = w[0];
      (cat.byLetter[l] = cat.byLetter[l] || []).push(w);
    });
    INDEX[key] = cat;
  });

  function list() {
    return ordered.map(function (key) {
      return {
        key: key,
        label: CATEGORIES[key].label,
        blurb: CATEGORIES[key].blurb,
        glyph: CATEGORIES[key].glyph,
        count: CATEGORIES[key].words.length
      };
    });
  }

  function has(category, word) {
    var cat = INDEX[category];
    return !!(cat && cat.map[normalize(word)]);
  }

  function get(category, word) {
    var cat = INDEX[category];
    return (cat && cat.map[normalize(word)]) || null;
  }

  function wordsFor(category, letter) {
    var cat = INDEX[category];
    if (!cat) return [];
    return (cat.byLetter[String(letter || "").toUpperCase()[0]] || []).slice();
  }

  function randomWord(category, letter) {
    var pool = wordsFor(category, letter);
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Simple edit distance for "did you mean" hints.
  function distance(a, b) {
    a = normalize(a); b = normalize(b);
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var prev = new Array(n + 1);
    var cur = new Array(n + 1);
    for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      cur[0] = i;
      for (var k = 1; k <= n; k++) {
        cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
      }
      var tmp = prev; prev = cur; cur = tmp;
    }
    return prev[n];
  }

  function suggest(category, word, limit) {
    var cat = INDEX[category];
    var norm = normalize(word);
    if (!cat || norm.length < 3) return [];
    var best = [];
    for (var i = 0; i < cat.words.length; i++) {
      var w = cat.words[i];
      if (Math.abs(w.length - norm.length) > 2) continue;
      var d = distance(w, norm);
      if (d <= 2) best.push({ word: cat.map[w].word, distance: d });
    }
    best.sort(function (a, b) { return a.distance - b.distance || a.word.length - b.word.length; });
    return best.slice(0, limit || 2).map(function (x) { return x.word; });
  }

  return {
    categories: CATEGORIES,
    list: list,
    normalize: normalize,
    firstLetter: firstLetter,
    lastLetter: lastLetter,
    has: has,
    get: get,
    wordsFor: wordsFor,
    randomWord: randomWord,
    suggest: suggest
  };
});
