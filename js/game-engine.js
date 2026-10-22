/**
 * ATLAS — Standalone Authoritative Game Engine & Curated Datasets
 * Zero-dependency client-side implementation for GitHub Pages
 */

const DATASETS = {
  COUNTRIES: [
    "AFGHANISTAN", "ALBANIA", "ALGERIA", "ANDORRA", "ANGOLA", "ARGENTINA", "ARMENIA", "AUSTRALIA",
    "AUSTRIA", "AZERBAIJAN", "BAHAMAS", "BAHRAIN", "BANGLADESH", "BARBADOS", "BELARUS", "BELGIUM",
    "BELIZE", "BENIN", "BHUTAN", "BOLIVIA", "BOSNIA", "BOTSWANA", "BRAZIL", "BRUNEI", "BULGARIA",
    "CAMBODIA", "CAMEROON", "CANADA", "CHAD", "CHILE", "CHINA", "COLOMBIA", "CONGO", "COSTA RICA",
    "CROATIA", "CUBA", "CYPRUS", "CZECH REPUBLIC", "DENMARK", "ECUADOR", "EGYPT", "ESTONIA",
    "ETHIOPIA", "FIJI", "FINLAND", "FRANCE", "GERMANY", "GHANA", "GREECE", "GUATEMALA", "GUINEA",
    "HAITI", "HONDURAS", "HUNGARY", "ICELAND", "INDIA", "INDONESIA", "IRAN", "IRAQ", "IRELAND",
    "ISRAEL", "ITALY", "JAMAICA", "JAPAN", "JORDAN", "KAZAKHSTAN", "KENYA", "KUWAIT", "LAOS",
    "LATVIA", "LEBANON", "LIBERIA", "LIBYA", "LITHUANIA", "LUXEMBOURG", "MADAGASCAR", "MALAYSIA",
    "MALDIVES", "MALI", "MALTA", "MEXICO", "MONACO", "MONGOLIA", "MOROCCO", "MYANMAR", "NAMIBIA",
    "NEPAL", "NETHERLANDS", "NEW ZEALAND", "NICARAGUA", "NIGERIA", "NORWAY", "OMAN", "PAKISTAN",
    "PANAMA", "PARAGUAY", "PERU", "PHILIPPINES", "POLAND", "PORTUGAL", "QATAR", "ROMANIA",
    "RUSSIA", "RWANDA", "SAUDI ARABIA", "SENEGAL", "SERBIA", "SINGAPORE", "SLOVAKIA", "SLOVENIA",
    "SOMALIA", "SOUTH AFRICA", "SOUTH KOREA", "SPAIN", "SRI LANKA", "SUDAN", "SWEDEN", "SWITZERLAND",
    "SYRIA", "TAIWAN", "TANZANIA", "THAILAND", "TUNISIA", "TURKEY", "UGANDA", "UKRAINE", "UNITED KINGDOM",
    "UNITED STATES", "URUGUAY", "UZBEKISTAN", "VENEZUELA", "VIETNAM", "YEMEN", "ZAMBIA", "ZIMBABWE"
  ],
  CITIES: [
    "AMSTERDAM", "ATHENS", "AUCKLAND", "BANGKOK", "BARCELONA", "BEIJING", "BERLIN", "BOGOTA",
    "BOSTON", "BRUSSELS", "BUDAPEST", "BUENOS AIRES", "CAIRO", "CAPE TOWN", "CHICAGO", "COPENHAGEN",
    "DALLAS", "DELHI", "DOHA", "DUBAI", "DUBLIN", "EDINBURGH", "FLORENCE", "FRANKFURT", "GENEVA",
    "HAVANA", "HELSINKI", "HONG KONG", "HONOLULU", "ISTANBUL", "JAKARTA", "JERUSALEM", "JOHANNESBURG",
    "KIEV", "KUALA LUMPUR", "LAGOS", "LIMA", "LISBON", "LONDON", "LOS ANGELES", "MADRID", "MANILA",
    "MELBOURNE", "MEXICO CITY", "MIAMI", "MILAN", "MONTREAL", "MOSCOW", "MUMBAI", "MUNICH", "NAIROBI",
    "NEW YORK", "OSLO", "PARIS", "PRAGUE", "REYKJAVIK", "RIO DE JANEIRO", "ROME", "SAN FRANCISCO",
    "SANTIAGO", "SAO PAULO", "SEATTLE", "SEOUL", "SHANGHAI", "SINGAPORE", "STOCKHOLM", "SYDNEY",
    "TAIPEI", "TOKYO", "TORONTO", "VANCOUVER", "VENICE", "VIENNA", "WARSAW", "WASHINGTON", "ZURICH"
  ],
  PLACES: [
    "AFRICA", "AMERICA", "ASIA", "EUROPE", "NORTH AMERICA", "SOUTH AMERICA", "AUSTRALIA", "ANTARCTICA",
    "SAHARA", "AMAZON", "ALPS", "ANDES", "HIMALAYAS", "ROCKY MOUNTAINS", "NIAGARA FALLS",
    "GRAND CANYON", "MOUNT EVEREST", "KILIMANJARO", "GREAT BARRIER REEF", "PACIFIC OCEAN",
    "ATLANTIC OCEAN", "INDIAN OCEAN", "ARCTIC OCEAN", "MEDITERRANEAN SEA", "CARIBBEAN SEA",
    "BALTIC SEA", "RED SEA", "BLACK SEA", "CASPIAN SEA", "DEAD SEA", "LAKE VICTORIA", "LAKE SUPERIOR",
    "HAWAII", "GREENLAND", "MADAGASCAR", "BALI", "SANTORINI", "IBIZA", "TAHITI", "MACHU PICCHU",
    "COLOSSEUM", "PETRA", "TAJ MAHAL", "CHICHEN ITZA", "GREAT WALL OF CHINA", "PYRAMIDS OF GIZA",
    "EIFFEL TOWER", "BIG BEN", "STATUE OF LIBERTY", "SYDNEY OPERA HOUSE", "BURJ KHALIFA"
  ],
  ANIMALS: [
    "ALLIGATOR", "ALPACA", "ANTELOPE", "BEAR", "BEAVER", "BISON", "CAMEL", "CAPYBARA", "CAT",
    "CHAMELEON", "CHEETAH", "CHIMPANZEE", "COUGAR", "CROCODILE", "DEER", "DOLPHIN", "DONKEY",
    "EAGLE", "ELEPHANT", "ELK", "FALCON", "FLAMINGO", "FOX", "FROG", "GAZELLE", "GIRAFFE",
    "GOAT", "GORILLA", "HAMSTER", "HARE", "HEDGEHOG", "HIPPOPOTAMUS", "HORSE", "HYENA", "IGUANA",
    "JAGUAR", "KANGAROO", "KOALA", "LEOPARD", "LION", "LLAMA", "LYNX", "MONKEY", "MOOSE", "MOUSE",
    "OCTOPUS", "OSTRICH", "OTTER", "OWL", "PANDA", "PANTHER", "PARROT", "PELICAN", "PENGUIN",
    "PIG", "PLATYPUS", "RABBIT", "RACCOON", "RAT", "RHINOCEROS", "SEAL", "SHARK", "SHEEP",
    "SLOTH", "SNAKE", "SQUIRREL", "SWAN", "TIGER", "TORTOISE", "TURTLE", "WALRUS", "WHALE", "WOLF", "ZEBRA"
  ],
  MOVIES: [
    "ALIEN", "AVATAR", "BACK TO THE FUTURE", "BATMAN BEGINS", "BLADE RUNNER", "BRAVEHEART",
    "CASABLANCA", "DUNE", "FARGO", "FIGHT CLUB", "FORREST GUMP", "GLADIATOR", "GOODFELLAS",
    "HEAT", "INCEPTION", "INTERSTELLAR", "JAWS", "JOKER", "JURASSIC PARK", "KILL BILL",
    "MEMENTO", "OPPENHEIMER", "PARASITE", "PSYCHO", "PULP FICTION", "ROCKY", "SCARFACE",
    "STAR WARS", "TERMINATOR", "THE DARK KNIGHT", "THE GODFATHER", "THE MATRIX", "TITANIC", "WALL-E", "WHIPLASH"
  ],
  FOOD: [
    "APPLE", "AVOCADO", "BAGEL", "BAKLAVA", "BANANA", "BIRYANI", "BREAD", "BURGER", "BURRITO",
    "CAKE", "CHEESE", "CHICKEN", "CHOCOLATE", "COOKIE", "CROISSANT", "CURRY", "DONUT", "DUMPLINGS",
    "ENCHILADA", "FALAFEL", "FISH", "FRIES", "GUACAMOLE", "HUMMUS", "ICE CREAM", "KEBAB",
    "LASAGNA", "MANGO", "MUFFIN", "NACHOS", "NOODLES", "OMELET", "PANCAKE", "PASTA", "PIZZA",
    "RAMEN", "RAVIOLI", "RISOTTO", "SALAD", "SANDWICH", "SOUP", "SPAGHETTI", "STEAK", "SUSHI", "TACOS", "WAFFLES"
  ]
};

// Combine all geography into PLACES
DATASETS.PLACES = [...new Set([...DATASETS.PLACES, ...DATASETS.COUNTRIES, ...DATASETS.CITIES])];

const Normalizer = {
  normalize(str) {
    if (!str) return "";
    return str
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/[\s-]+/g, " ")
      .toUpperCase();
  },
  getFirstLetter(str) {
    const clean = this.normalize(str);
    for (let i = 0; i < clean.length; i++) {
      if (clean[i] >= "A" && clean[i] <= "Z") return clean[i];
    }
    return "";
  },
  getLastLetter(str) {
    const clean = this.normalize(str);
    for (let i = clean.length - 1; i >= 0; i--) {
      if (clean[i] >= "A" && clean[i] <= "Z") return clean[i];
    }
    return "";
  }
};

const Scorer = {
  calculateSpeedBonus(remainingSec) {
    if (remainingSec >= 12) return 5;
    if (remainingSec >= 8) return 3;
    if (remainingSec >= 4) return 2;
    if (remainingSec >= 1) return 1;
    return 0;
  },
  calculateStreakBonus(streak) {
    if (streak === 10) return 20;
    if (streak === 5) return 10;
    if (streak === 3) return 5;
    return 0;
  }
};

class AtlasGameEngine {
  constructor(roomId, config, players) {
    this.roomId = roomId;
    this.config = config || { category: "PLACES", turnDurationSeconds: 15, maxPasses: 3 };
    this.players = players || [
      { id: "p1", name: "You", score: 0, passes: 3, strikes: 0, streak: 0, bestStreak: 0, eliminated: false },
      { id: "p2", name: "Elena", score: 0, passes: 3, strikes: 0, streak: 0, bestStreak: 0, eliminated: false },
      { id: "p3", name: "Kenji", score: 0, passes: 3, strikes: 0, streak: 0, bestStreak: 0, eliminated: false }
    ];
    this.activePlayerIndex = 0;
    this.requiredLetter = "A";
    this.roundNumber = 1;
    this.turnNumber = 1;
    this.usedAnswers = new Set();
    this.lastAcceptedWord = null;
    this.deadlineTimestamp = Date.now() + this.config.turnDurationSeconds * 1000;
    this.status = "PLAYER_TURN";
    this.activeDispute = null;
    this.winner = null;
    this.listeners = [];
  }

  subscribe(fn) {
    this.listeners.push(fn);
    fn(this.getState());
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  notify() {
    const s = this.getState();
    this.listeners.forEach(fn => fn(s));
    this.save();
  }

  getState() {
    return {
      roomId: this.roomId,
      config: this.config,
      status: this.status,
      roundNumber: this.roundNumber,
      turnNumber: this.turnNumber,
      requiredLetter: this.requiredLetter,
      activePlayer: this.players[this.activePlayerIndex],
      players: [...this.players],
      lastAcceptedWord: this.lastAcceptedWord,
      deadlineTimestamp: this.deadlineTimestamp,
      activeDispute: this.activeDispute,
      winner: this.winner
    };
  }

  submitAnswer(playerId, rawWord) {
    if (this.status !== "PLAYER_TURN") return { success: false, error: "Not waiting for turn" };
    const active = this.players[this.activePlayerIndex];
    if (active.id !== playerId) return { success: false, error: "Not your turn!" };

    const norm = Normalizer.normalize(rawWord);
    if (!norm) return { success: false, error: "Answer cannot be empty" };

    if (Normalizer.getFirstLetter(norm) !== this.requiredLetter) {
      return { success: false, error: `Word must start with letter "${this.requiredLetter}"` };
    }

    if (this.usedAnswers.has(norm)) {
      return { success: false, error: `"${rawWord}" was already used in this game!` };
    }

    // Check dataset
    const bank = DATASETS[this.config.category] || DATASETS.PLACES;
    const recognized = bank.includes(norm);

    const remainingSec = Math.max(0, Math.ceil((this.deadlineTimestamp - Date.now()) / 1000));

    if (recognized) {
      return this.acceptWord(active, rawWord, norm, remainingSec);
    } else {
      // Trigger 10-second peer challenge!
      return this.triggerDispute(active, rawWord, norm);
    }
  }

  acceptWord(player, displayWord, norm, remainingSec) {
    player.streak += 1;
    if (player.streak > player.bestStreak) player.bestStreak = player.streak;

    const speedBonus = Scorer.calculateSpeedBonus(remainingSec);
    const streakBonus = Scorer.calculateStreakBonus(player.streak);
    const totalPoints = 10 + speedBonus + streakBonus;

    player.score += totalPoints;
    this.usedAnswers.add(norm);

    this.lastAcceptedWord = {
      word: displayWord.toUpperCase(),
      submittedBy: player.name,
      points: totalPoints
    };

    this.requiredLetter = Normalizer.getLastLetter(norm);
    this.advanceTurn();
    return { success: true, points: totalPoints };
  }

  triggerDispute(player, displayWord, norm) {
    this.status = "VOTING_PERIOD";
    this.activeDispute = {
      word: displayWord.toUpperCase(),
      norm,
      submittingPlayer: player,
      deadline: Date.now() + 10000,
      votesValid: 1, // Simulated AI / peer consensus
      votesInvalid: 0
    };
    this.notify();
    return { success: true, challenged: true };
  }

  resolveDispute(isValid) {
    if (!this.activeDispute) return;
    const submitter = this.activeDispute.submittingPlayer;

    if (isValid) {
      this.usedAnswers.add(this.activeDispute.norm);
      submitter.score += 10;
      submitter.streak += 1;
      this.lastAcceptedWord = {
        word: this.activeDispute.word,
        submittedBy: submitter.name,
        points: 10
      };
      this.requiredLetter = Normalizer.getLastLetter(this.activeDispute.norm);
    } else {
      submitter.streak = 0;
      submitter.strikes += 1;
      if (submitter.strikes >= 3) {
        submitter.eliminated = true;
      }
    }

    this.activeDispute = null;
    this.status = "PLAYER_TURN";
    this.advanceTurn();
  }

  usePass(playerId) {
    const active = this.players[this.activePlayerIndex];
    if (active.id !== playerId) return { success: false, error: "Not your turn" };
    if (active.passes <= 0) return { success: false, error: "No passes left" };

    active.passes -= 1;
    active.streak = 0;
    // Letter preserved!
    this.advanceTurn();
    return { success: true };
  }

  handleTimeout() {
    const active = this.players[this.activePlayerIndex];
    active.streak = 0;
    active.strikes += 1;
    if (active.strikes >= 3) {
      active.eliminated = true;
    }
    this.advanceTurn();
  }

  advanceTurn() {
    const survivors = this.players.filter(p => !p.eliminated);
    if (survivors.length <= 1) {
      this.status = "GAME_OVER";
      this.winner = survivors[0] || this.players[0];
      this.notify();
      return;
    }

    const prevIndex = this.activePlayerIndex;
    let nextIndex = (prevIndex + 1) % this.players.length;
    while (this.players[nextIndex].eliminated) {
      nextIndex = (nextIndex + 1) % this.players.length;
    }

    this.activePlayerIndex = nextIndex;
    this.turnNumber += 1;
    if (nextIndex <= prevIndex) {
      this.roundNumber += 1;
    }

    this.deadlineTimestamp = Date.now() + this.config.turnDurationSeconds * 1000;
    this.notify();

    // If opponent turn (AI / simulated multi-tab player), execute bot answer after 2-4 seconds!
    const activeNow = this.players[this.activePlayerIndex];
    if (activeNow.id !== "p1") {
      setTimeout(() => this.simulateBotTurn(activeNow), 2500);
    }
  }

  simulateBotTurn(bot) {
    if (this.status !== "PLAYER_TURN" || this.players[this.activePlayerIndex].id !== bot.id) return;
    const bank = DATASETS[this.config.category] || DATASETS.PLACES;
    const candidates = bank.filter(w => Normalizer.getFirstLetter(w) === this.requiredLetter && !this.usedAnswers.has(w));

    if (candidates.length > 0) {
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      this.submitAnswer(bot.id, chosen);
    } else {
      if (bot.passes > 0) {
        this.usePass(bot.id);
      } else {
        this.handleTimeout();
      }
    }
  }

  save() {
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("atlas_standalone_engine", JSON.stringify(this.getState()));
      } catch (e) {}
    }
  }
}
