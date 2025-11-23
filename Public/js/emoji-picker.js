// Emoji data organized by categories
const emojiData = {
    smileys: [
        { emoji: '😀', keywords: ['grinning', 'happy', 'smile', 'joy'] },
        { emoji: '😃', keywords: ['smiley', 'happy', 'joy', 'cheerful'] },
        { emoji: '😄', keywords: ['smile', 'happy', 'joy', 'laugh'] },
        { emoji: '😁', keywords: ['grin', 'happy', 'smile', 'joy'] },
        { emoji: '😆', keywords: ['laughing', 'happy', 'haha', 'joy'] },
        { emoji: '😅', keywords: ['sweat', 'smile', 'relief', 'nervous'] },
        { emoji: '🤣', keywords: ['rofl', 'laughing', 'funny', 'hilarious'] },
        { emoji: '😂', keywords: ['tears', 'joy', 'funny', 'laughing'] },
        { emoji: '🙂', keywords: ['smile', 'happy', 'positive'] },
        { emoji: '🙃', keywords: ['upside', 'down', 'silly', 'playful'] },
        { emoji: '😉', keywords: ['wink', 'flirt', 'playful'] },
        { emoji: '😊', keywords: ['blush', 'happy', 'smile', 'joy'] },
        { emoji: '😇', keywords: ['angel', 'innocent', 'halo'] },
        { emoji: '🥰', keywords: ['love', 'hearts', 'adore', 'crush'] },
        { emoji: '😍', keywords: ['heart', 'eyes', 'love', 'crush'] },
        { emoji: '🤩', keywords: ['star', 'struck', 'excited', 'amazing'] },
        { emoji: '😘', keywords: ['kiss', 'love', 'heart', 'affection'] },
        { emoji: '😗', keywords: ['kiss', 'love', 'affection'] },
        { emoji: '😚', keywords: ['kiss', 'closed', 'eyes', 'love'] },
        { emoji: '😙', keywords: ['kiss', 'smile', 'affection'] },
        { emoji: '😋', keywords: ['yum', 'tongue', 'lick', 'tasty'] },
        { emoji: '😛', keywords: ['tongue', 'playful', 'silly'] },
        { emoji: '😜', keywords: ['wink', 'tongue', 'playful', 'silly'] },
        { emoji: '🤪', keywords: ['crazy', 'wild', 'silly', 'goofy'] },
        { emoji: '😝', keywords: ['tongue', 'closed', 'eyes', 'playful'] },
        { emoji: '🤑', keywords: ['money', 'rich', 'greedy', 'cash'] },
        { emoji: '🤗', keywords: ['hug', 'embrace', 'love', 'care'] },
        { emoji: '🤭', keywords: ['giggle', 'chuckle', 'secret', 'oops'] },
        { emoji: '🤫', keywords: ['shush', 'quiet', 'secret', 'silence'] },
        { emoji: '🤔', keywords: ['thinking', 'hmm', 'consider', 'ponder'] },
        { emoji: '🤐', keywords: ['zipper', 'mouth', 'secret', 'quiet'] },
        { emoji: '🤨', keywords: ['eyebrow', 'suspicious', 'skeptical'] },
        { emoji: '😐', keywords: ['neutral', 'meh', 'blank', 'expressionless'] },
        { emoji: '😑', keywords: ['expressionless', 'blank', 'meh'] },
        { emoji: '😶', keywords: ['no', 'mouth', 'quiet', 'silence'] },
        { emoji: '😏', keywords: ['smirk', 'smug', 'sly', 'mischievous'] },
        { emoji: '😒', keywords: ['unamused', 'meh', 'annoyed'] },
        { emoji: '🙄', keywords: ['eye', 'roll', 'annoyed', 'whatever'] },
        { emoji: '😬', keywords: ['grimace', 'awkward', 'nervous'] },
        { emoji: '🤥', keywords: ['lying', 'pinocchio', 'dishonest'] },
        { emoji: '😔', keywords: ['sad', 'down', 'unhappy', 'disappointed'] },
        { emoji: '😕', keywords: ['confused', 'sad', 'disappointed'] },
        { emoji: '🙁', keywords: ['frown', 'sad', 'unhappy'] },
        { emoji: '☹️', keywords: ['frown', 'sad', 'unhappy'] },
        { emoji: '😖', keywords: ['confounded', 'frustrated', 'annoyed'] },
        { emoji: '😞', keywords: ['disappointed', 'sad', 'upset'] },
        { emoji: '😟', keywords: ['worried', 'concerned', 'anxious'] },
        { emoji: '😤', keywords: ['huff', 'annoyed', 'frustrated', 'steam'] },
        { emoji: '😢', keywords: ['cry', 'sad', 'tear', 'upset'] },
        { emoji: '😭', keywords: ['sob', 'cry', 'bawl', 'sad'] },
        { emoji: '😦', keywords: ['frown', 'open', 'mouth', 'surprised'] },
        { emoji: '😧', keywords: ['anguish', 'stunned', 'surprised'] },
        { emoji: '😨', keywords: ['fear', 'scared', 'shocked'] },
        { emoji: '😩', keywords: ['weary', 'tired', 'frustrated'] },
        { emoji: '🤯', keywords: ['mind', 'blown', 'shocked', 'amazed'] },
        { emoji: '😬', keywords: ['grimace', 'awkward', 'oops'] },
        { emoji: '😰', keywords: ['anxious', 'sweat', 'nervous'] },
        { emoji: '😱', keywords: ['scream', 'fear', 'shocked', 'surprised'] },
        { emoji: '🥵', keywords: ['hot', 'heat', 'sweat', 'fever'] },
        { emoji: '🥶', keywords: ['cold', 'freeze', 'ice', 'frozen'] },
        { emoji: '😳', keywords: ['flushed', 'embarrassed', 'shy'] },
        { emoji: '🤪', keywords: ['zany', 'crazy', 'silly', 'wild'] },
        { emoji: '😵', keywords: ['dizzy', 'confused', 'knocked', 'out'] },
        { emoji: '🤢', keywords: ['nausea', 'sick', 'gross', 'disgusted'] },
        { emoji: '🤮', keywords: ['vomit', 'sick', 'puke', 'disgusted'] },
        { emoji: '🤧', keywords: ['sneeze', 'sick', 'allergy', 'tissue'] },
        { emoji: '😷', keywords: ['mask', 'sick', 'doctor', 'medical'] },
        { emoji: '🤒', keywords: ['thermometer', 'sick', 'fever', 'ill'] },
        { emoji: '🤕', keywords: ['bandage', 'hurt', 'injured', 'clumsy'] }
    ],
    people: [
        { emoji: '👋', keywords: ['wave', 'hello', 'hi', 'goodbye'] },
        { emoji: '🤚', keywords: ['raised', 'back', 'hand', 'stop'] },
        { emoji: '🖐️', keywords: ['hand', 'five', 'fingers', 'palm'] },
        { emoji: '✋', keywords: ['raised', 'hand', 'stop', 'halt'] },
        { emoji: '🖖', keywords: ['vulcan', 'spock', 'star', 'trek'] },
        { emoji: '👌', keywords: ['ok', 'perfect', 'good', 'excellent'] },
        { emoji: '🤏', keywords: ['pinch', 'small', 'tiny', 'little'] },
        { emoji: '✌️', keywords: ['peace', 'victory', 'two', 'fingers'] },
        { emoji: '🤞', keywords: ['cross', 'fingers', 'luck', 'hope'] },
        { emoji: '🤟', keywords: ['love', 'you', 'hand', 'ily'] },
        { emoji: '🤘', keywords: ['rock', 'on', 'metal', 'horns'] },
        { emoji: '🤙', keywords: ['call', 'me', 'phone', 'hang', 'loose'] },
        { emoji: '👈', keywords: ['point', 'left', 'direction'] },
        { emoji: '👉', keywords: ['point', 'right', 'direction'] },
        { emoji: '👆', keywords: ['point', 'up', 'direction'] },
        { emoji: '🖕', keywords: ['middle', 'finger', 'rude', 'offensive'] },
        { emoji: '👇', keywords: ['point', 'down', 'direction'] },
        { emoji: '☝️', keywords: ['point', 'up', 'index', 'finger'] },
        { emoji: '👍', keywords: ['thumbs', 'up', 'good', 'approve', 'like'] },
        { emoji: '👎', keywords: ['thumbs', 'down', 'bad', 'disapprove', 'dislike'] },
        { emoji: '✊', keywords: ['fist', 'power', 'strength', 'solidarity'] },
        { emoji: '👊', keywords: ['punch', 'fist', 'bump', 'fight'] },
        { emoji: '🤛', keywords: ['left', 'fist', 'bump'] },
        { emoji: '🤜', keywords: ['right', 'fist', 'bump'] },
        { emoji: '👏', keywords: ['clap', 'applause', 'praise', 'congratulations'] },
        { emoji: '🙌', keywords: ['raise', 'hands', 'celebration', 'hooray'] },
        { emoji: '👐', keywords: ['open', 'hands', 'hug', 'embrace'] },
        { emoji: '🤲', keywords: ['palms', 'up', 'pray', 'ask'] },
        { emoji: '🤝', keywords: ['handshake', 'deal', 'agreement', 'meeting'] },
        { emoji: '🙏', keywords: ['pray', 'thanks', 'please', 'hope'] }
    ],
    animals: [
        { emoji: '🐶', keywords: ['dog', 'puppy', 'pet', 'animal'] },
        { emoji: '🐱', keywords: ['cat', 'kitten', 'pet', 'animal'] },
        { emoji: '🐭', keywords: ['mouse', 'rodent', 'small', 'animal'] },
        { emoji: '🐹', keywords: ['hamster', 'pet', 'rodent', 'cute'] },
        { emoji: '🐰', keywords: ['rabbit', 'bunny', 'easter', 'cute'] },
        { emoji: '🦊', keywords: ['fox', 'clever', 'sly', 'orange'] },
        { emoji: '🐻', keywords: ['bear', 'teddy', 'strong', 'wild'] },
        { emoji: '🐼', keywords: ['panda', 'bear', 'china', 'bamboo'] },
        { emoji: '🐨', keywords: ['koala', 'australia', 'marsupial', 'cute'] },
        { emoji: '🐯', keywords: ['tiger', 'stripes', 'wild', 'fierce'] },
        { emoji: '🦁', keywords: ['lion', 'king', 'mane', 'brave'] },
        { emoji: '🐮', keywords: ['cow', 'moo', 'milk', 'farm'] },
        { emoji: '🐷', keywords: ['pig', 'oink', 'farm', 'pink'] },
        { emoji: '🐸', keywords: ['frog', 'green', 'pond', 'ribbit'] },
        { emoji: '🐵', keywords: ['monkey', 'banana', 'playful', 'swing'] },
        { emoji: '🙈', keywords: ['see', 'no', 'evil', 'monkey'] },
        { emoji: '🙉', keywords: ['hear', 'no', 'evil', 'monkey'] },
        { emoji: '🙊', keywords: ['speak', 'no', 'evil', 'monkey'] },
        { emoji: '🐒', keywords: ['monkey', 'banana', 'swing', 'playful'] },
        { emoji: '🦍', keywords: ['gorilla', 'strong', 'ape', 'king', 'kong'] },
        { emoji: '🐕', keywords: ['dog', 'loyal', 'pet', 'friend'] },
        { emoji: '🐩', keywords: ['poodle', 'fancy', 'dog', 'curly'] },
        { emoji: '🐺', keywords: ['wolf', 'howl', 'pack', 'wild'] },
        { emoji: '🦝', keywords: ['raccoon', 'mask', 'trash', 'bandit'] },
        { emoji: '🐈', keywords: ['cat', 'meow', 'pet', 'independent'] },
        { emoji: '🦘', keywords: ['kangaroo', 'australia', 'hop', 'pouch'] },
        { emoji: '🦡', keywords: ['badger', 'dig', 'burrow', 'stripe'] },
        { emoji: '🐎', keywords: ['horse', 'gallop', 'ride', 'fast'] },
        { emoji: '🦄', keywords: ['unicorn', 'magic', 'rainbow', 'fantasy'] },
        { emoji: '🐝', keywords: ['bee', 'honey', 'buzz', 'pollinate'] },
        { emoji: '🐛', keywords: ['bug', 'insect', 'caterpillar', 'crawl'] },
        { emoji: '🦋', keywords: ['butterfly', 'beautiful', 'transform', 'fly'] },
        { emoji: '🐌', keywords: ['snail', 'slow', 'shell', 'slimy'] },
        { emoji: '🐞', keywords: ['ladybug', 'lucky', 'red', 'spots'] },
        { emoji: '🐜', keywords: ['ant', 'work', 'colony', 'strong'] },
        { emoji: '🦗', keywords: ['cricket', 'chirp', 'night', 'sound'] },
        { emoji: '🕷️', keywords: ['spider', 'web', 'eight', 'legs'] },
        { emoji: '🦂', keywords: ['scorpion', 'sting', 'desert', 'dangerous'] },
        { emoji: '🐢', keywords: ['turtle', 'slow', 'shell', 'steady'] },
        { emoji: '🐍', keywords: ['snake', 'slither', 'hiss', 'danger'] },
        { emoji: '🦎', keywords: ['lizard', 'gecko', 'reptile', 'wall'] },
        { emoji: '🐙', keywords: ['octopus', 'tentacles', 'sea', 'smart'] },
        { emoji: '🦑', keywords: ['squid', 'tentacles', 'sea', 'ink'] },
        { emoji: '🦐', keywords: ['shrimp', 'small', 'sea', 'food'] },
        { emoji: '🦞', keywords: ['lobster', 'claws', 'sea', 'red'] },
        { emoji: '🦀', keywords: ['crab', 'claws', 'beach', 'sideways'] },
        { emoji: '🐡', keywords: ['blowfish', 'puffer', 'spiky', 'sea'] },
        { emoji: '🐠', keywords: ['tropical', 'fish', 'colorful', 'sea'] },
        { emoji: '🐟', keywords: ['fish', 'swim', 'water', 'sea'] },
        { emoji: '🐬', keywords: ['dolphin', 'smart', 'playful', 'sea'] },
        { emoji: '🐳', keywords: ['whale', 'big', 'ocean', 'spout'] },
        { emoji: '🐋', keywords: ['whale', 'huge', 'ocean', 'mammal'] },
        { emoji: '🦈', keywords: ['shark', 'dangerous', 'teeth', 'ocean'] }
    ],
    food: [
        { emoji: '🍎', keywords: ['apple', 'fruit', 'red', 'healthy'] },
        { emoji: '🍊', keywords: ['orange', 'fruit', 'citrus', 'vitamin'] },
        { emoji: '🍋', keywords: ['lemon', 'sour', 'yellow', 'citrus'] },
        { emoji: '🍌', keywords: ['banana', 'yellow', 'potassium', 'monkey'] },
        { emoji: '🍉', keywords: ['watermelon', 'summer', 'juicy', 'red'] },
        { emoji: '🍇', keywords: ['grapes', 'wine', 'purple', 'bunch'] },
        { emoji: '🍓', keywords: ['strawberry', 'red', 'sweet', 'berry'] },
        { emoji: '🍈', keywords: ['melon', 'cantaloupe', 'sweet', 'orange'] },
        { emoji: '🍒', keywords: ['cherry', 'red', 'sweet', 'pair'] },
        { emoji: '🍑', keywords: ['peach', 'fuzzy', 'sweet', 'pink'] },
        { emoji: '🥭', keywords: ['mango', 'tropical', 'sweet', 'orange'] },
        { emoji: '🍍', keywords: ['pineapple', 'tropical', 'sweet', 'spiky'] },
        { emoji: '🥥', keywords: ['coconut', 'tropical', 'milk', 'hard'] },
        { emoji: '🥝', keywords: ['kiwi', 'green', 'fuzzy', 'tart'] },
        { emoji: '🍅', keywords: ['tomato', 'red', 'vegetable', 'salad'] },
        { emoji: '🍆', keywords: ['eggplant', 'purple', 'vegetable'] },
        { emoji: '🥑', keywords: ['avocado', 'green', 'healthy', 'toast'] },
        { emoji: '🥦', keywords: ['broccoli', 'green', 'healthy', 'vegetable'] },
        { emoji: '🥬', keywords: ['leafy', 'greens', 'lettuce', 'salad'] },
        { emoji: '🥒', keywords: ['cucumber', 'green', 'fresh', 'cool'] },
        { emoji: '🌶️', keywords: ['pepper', 'hot', 'spicy', 'red'] },
        { emoji: '🌽', keywords: ['corn', 'yellow', 'kernels', 'cob'] },
        { emoji: '🥕', keywords: ['carrot', 'orange', 'healthy', 'rabbit'] },
        { emoji: '🥔', keywords: ['potato', 'brown', 'starch', 'fries'] },
        { emoji: '🍠', keywords: ['sweet', 'potato', 'orange', 'healthy'] },
        { emoji: '🥐', keywords: ['croissant', 'french', 'pastry', 'buttery'] },
        { emoji: '🍞', keywords: ['bread', 'loaf', 'wheat', 'slice'] },
        { emoji: '🥖', keywords: ['baguette', 'french', 'bread', 'long'] },
        { emoji: '🥨', keywords: ['pretzel', 'twisted', 'salty', 'german'] },
        { emoji: '🥯', keywords: ['bagel', 'round', 'bread', 'hole'] },
        { emoji: '🧀', keywords: ['cheese', 'yellow', 'dairy', 'mouse'] },
        { emoji: '🥚', keywords: ['egg', 'white', 'protein', 'chicken'] },
        { emoji: '🍳', keywords: ['cooking', 'egg', 'frying', 'pan'] },
        { emoji: '🥞', keywords: ['pancakes', 'stack', 'syrup', 'breakfast'] },
        { emoji: '🧇', keywords: ['waffle', 'square', 'syrup', 'breakfast'] },
        { emoji: '🥓', keywords: ['bacon', 'strips', 'pork', 'breakfast'] },
        { emoji: '🍗', keywords: ['poultry', 'leg', 'chicken', 'drumstick'] },
        { emoji: '🍖', keywords: ['meat', 'bone', 'steak', 'protein'] },
        { emoji: '🌭', keywords: ['hot', 'dog', 'sausage', 'mustard'] },
        { emoji: '🍔', keywords: ['hamburger', 'burger', 'beef', 'bun'] },
        { emoji: '🍟', keywords: ['fries', 'french', 'potato', 'golden'] },
        { emoji: '🍕', keywords: ['pizza', 'slice', 'cheese', 'italian'] },
        { emoji: '🥪', keywords: ['sandwich', 'bread', 'filling', 'lunch'] },
        { emoji: '🥙', keywords: ['stuffed', 'flatbread', 'wrap', 'pita'] },
        { emoji: '🌮', keywords: ['taco', 'mexican', 'shell', 'filling'] },
        { emoji: '🌯', keywords: ['burrito', 'wrap', 'mexican', 'filling'] },
        { emoji: '🥗', keywords: ['salad', 'green', 'healthy', 'vegetables'] },
        { emoji: '🥘', keywords: ['paella', 'shallow', 'pan', 'food'] },
        { emoji: '🍝', keywords: ['spaghetti', 'pasta', 'italian', 'noodles'] },
        { emoji: '🍜', keywords: ['ramen', 'noodles', 'soup', 'steaming'] },
        { emoji: '🍲', keywords: ['pot', 'food', 'stew', 'cooking'] },
        { emoji: '🍛', keywords: ['curry', 'rice', 'spicy', 'indian'] },
        { emoji: '🍣', keywords: ['sushi', 'japanese', 'fish', 'rice'] },
        { emoji: '🍱', keywords: ['bento', 'box', 'japanese', 'lunch'] },
        { emoji: '🥟', keywords: ['dumpling', 'chinese', 'steamed', 'filled'] },
        { emoji: '🍤', keywords: ['fried', 'shrimp', 'tempura', 'crispy'] },
        { emoji: '🍙', keywords: ['rice', 'ball', 'japanese', 'onigiri'] },
        { emoji: '🍘', keywords: ['rice', 'cracker', 'japanese', 'senbei'] },
        { emoji: '🍥', keywords: ['fish', 'cake', 'swirl', 'japanese'] },
        { emoji: '🥠', keywords: ['fortune', 'cookie', 'chinese', 'message'] },
        { emoji: '🥮', keywords: ['moon', 'cake', 'chinese', 'festival'] },
        { emoji: '🍢', keywords: ['oden', 'skewer', 'japanese', 'hot'] },
        { emoji: '🍡', keywords: ['dango', 'sweet', 'japanese', 'skewer'] },
        { emoji: '🍧', keywords: ['shaved', 'ice', 'dessert', 'cold'] },
        { emoji: '🍨', keywords: ['ice', 'cream', 'dessert', 'cold'] },
        { emoji: '🍦', keywords: ['soft', 'ice', 'cream', 'cone'] },
        { emoji: '🥧', keywords: ['pie', 'dessert', 'slice', 'crust'] },
        { emoji: '🧁', keywords: ['cupcake', 'dessert', 'sweet', 'frosting'] },
        { emoji: '🎂', keywords: ['birthday', 'cake', 'celebration', 'candles'] },
        { emoji: '🍰', keywords: ['cake', 'slice', 'dessert', 'sweet'] },
        { emoji: '🍪', keywords: ['cookie', 'sweet', 'dessert', 'chocolate'] },
        { emoji: '🍫', keywords: ['chocolate', 'bar', 'sweet', 'cocoa'] },
        { emoji: '🍬', keywords: ['candy', 'sweet', 'wrapper', 'sugar'] },
        { emoji: '🍭', keywords: ['lollipop', 'candy', 'sweet', 'stick'] }
    ],
    activities: [
        { emoji: '⚽', keywords: ['soccer', 'football', 'ball', 'sport'] },
        { emoji: '🏀', keywords: ['basketball', 'ball', 'sport', 'hoop'] },
        { emoji: '🏈', keywords: ['american', 'football', 'ball', 'sport'] },
        { emoji: '⚾', keywords: ['baseball', 'ball', 'sport', 'bat'] },
        { emoji: '🥎', keywords: ['softball', 'ball', 'sport', 'yellow'] },
        { emoji: '🎾', keywords: ['tennis', 'ball', 'sport', 'racket'] },
        { emoji: '🏐', keywords: ['volleyball', 'ball', 'sport', 'net'] },
        { emoji: '🏉', keywords: ['rugby', 'football', 'ball', 'sport'] },
        { emoji: '🥏', keywords: ['frisbee', 'disc', 'throw', 'catch'] },
        { emoji: '🎱', keywords: ['pool', 'billiards', 'eight', 'ball'] },
        { emoji: '🪀', keywords: ['yo-yo', 'toy', 'string', 'up', 'down'] },
        { emoji: '🏓', keywords: ['ping', 'pong', 'table', 'tennis'] },
        { emoji: '🏸', keywords: ['badminton', 'racket', 'shuttlecock', 'sport'] },
        { emoji: '🏒', keywords: ['ice', 'hockey', 'stick', 'puck'] },
        { emoji: '🏑', keywords: ['field', 'hockey', 'stick', 'ball'] },
        { emoji: '🥍', keywords: ['lacrosse', 'stick', 'ball', 'sport'] },
        { emoji: '🏏', keywords: ['cricket', 'bat', 'ball', 'sport'] },
        { emoji: '🎿', keywords: ['ski', 'snow', 'winter', 'sport'] },
        { emoji: '⛷️', keywords: ['skier', 'snow', 'winter', 'sport'] },
        { emoji: '🏂', keywords: ['snowboard', 'snow', 'winter', 'sport'] },
        { emoji: '🪂', keywords: ['parachute', 'skydive', 'fall', 'air'] },
        { emoji: '🏋️', keywords: ['weight', 'lifting', 'gym', 'strong'] },
        { emoji: '🤼', keywords: ['wrestling', 'sport', 'grapple', 'fight'] },
        { emoji: '🤸', keywords: ['cartwheel', 'gymnastics', 'flip', 'acrobat'] },
        { emoji: '⛹️', keywords: ['basketball', 'dribble', 'sport', 'bounce'] },
        { emoji: '🤺', keywords: ['fencing', 'sword', 'sport', 'mask'] },
        { emoji: '🏇', keywords: ['horse', 'racing', 'jockey', 'ride'] },
        { emoji: '⛷️', keywords: ['skiing', 'snow', 'winter', 'downhill'] },
        { emoji: '🏌️', keywords: ['golf', 'club', 'ball', 'swing'] },
        { emoji: '🏄', keywords: ['surfing', 'wave', 'board', 'ocean'] },
        { emoji: '🚣', keywords: ['rowing', 'boat', 'oar', 'water'] },
        { emoji: '🏊', keywords: ['swimming', 'pool', 'water', 'stroke'] },
        { emoji: '🏆', keywords: ['trophy', 'winner', 'first', 'place'] },
        { emoji: '🥇', keywords: ['gold', 'medal', 'first', 'winner'] },
        { emoji: '🥈', keywords: ['silver', 'medal', 'second', 'place'] },
        { emoji: '🥉', keywords: ['bronze', 'medal', 'third', 'place'] },
        { emoji: '🎯', keywords: ['target', 'bullseye', 'aim', 'goal'] },
        { emoji: '🎮', keywords: ['video', 'game', 'controller', 'play'] },
        { emoji: '🕹️', keywords: ['joystick', 'game', 'arcade', 'control'] },
        { emoji: '🎲', keywords: ['dice', 'game', 'chance', 'roll'] },
        { emoji: '♠️', keywords: ['spade', 'card', 'suit', 'black'] },
        { emoji: '♥️', keywords: ['heart', 'card', 'suit', 'red'] },
        { emoji: '♦️', keywords: ['diamond', 'card', 'suit', 'red'] },
        { emoji: '♣️', keywords: ['club', 'card', 'suit', 'black'] },
        { emoji: '♟️', keywords: ['chess', 'pawn', 'game', 'strategy'] },
        { emoji: '🃏', keywords: ['joker', 'card', 'wild', 'game'] },
        { emoji: '🀄', keywords: ['mahjong', 'tile', 'game', 'chinese'] },
        { emoji: '🎴', keywords: ['flower', 'playing', 'cards', 'japanese'] }
    ],
    travel: [
        { emoji: '🚗', keywords: ['car', 'automobile', 'vehicle', 'drive'] },
        { emoji: '🚕', keywords: ['taxi', 'cab', 'yellow', 'ride'] },
        { emoji: '🚙', keywords: ['suv', 'car', 'vehicle', 'utility'] },
        { emoji: '🚌', keywords: ['bus', 'public', 'transport', 'school'] },
        { emoji: '🚎', keywords: ['trolleybus', 'electric', 'bus', 'transport'] },
        { emoji: '🏎️', keywords: ['race', 'car', 'fast', 'speed'] },
        { emoji: '🚓', keywords: ['police', 'car', 'cop', 'law'] },
        { emoji: '🚑', keywords: ['ambulance', 'medical', 'emergency', 'hospital'] },
        { emoji: '🚒', keywords: ['fire', 'truck', 'engine', 'emergency'] },
        { emoji: '🚐', keywords: ['minibus', 'van', 'transport', 'group'] },
        { emoji: '🚚', keywords: ['delivery', 'truck', 'cargo', 'transport'] },
        { emoji: '🚛', keywords: ['articulated', 'lorry', 'truck', 'big'] },
        { emoji: '🚜', keywords: ['tractor', 'farm', 'agriculture', 'field'] },
        { emoji: '🏍️', keywords: ['motorcycle', 'bike', 'fast', 'two', 'wheels'] },
        { emoji: '🛵', keywords: ['scooter', 'motor', 'bike', 'vespa'] },
        { emoji: '🚲', keywords: ['bicycle', 'bike', 'pedal', 'exercise'] },
        { emoji: '🛴', keywords: ['scooter', 'kick', 'push', 'ride'] },
        { emoji: '🚁', keywords: ['helicopter', 'chopper', 'rotor', 'fly'] },
        { emoji: '✈️', keywords: ['airplane', 'plane', 'flight', 'travel'] },
        { emoji: '🛩️', keywords: ['small', 'airplane', 'plane', 'private'] },
        { emoji: '🛫', keywords: ['airplane', 'departure', 'takeoff', 'flight'] },
        { emoji: '🛬', keywords: ['airplane', 'arrival', 'landing', 'flight'] },
        { emoji: '🪂', keywords: ['parachute', 'skydive', 'jump', 'fall'] },
        { emoji: '💺', keywords: ['seat', 'chair', 'airplane', 'sit'] },
        { emoji: '🚀', keywords: ['rocket', 'space', 'launch', 'fast'] },
        { emoji: '🛸', keywords: ['ufo', 'flying', 'saucer', 'alien'] },
        { emoji: '🚉', keywords: ['station', 'train', 'railway', 'platform'] },
        { emoji: '🚞', keywords: ['mountain', 'railway', 'train', 'cable'] },
        { emoji: '🚝', keywords: ['monorail', 'train', 'transport', 'elevated'] },
        { emoji: '🚄', keywords: ['high', 'speed', 'train', 'bullet'] },
        { emoji: '🚅', keywords: ['bullet', 'train', 'fast', 'japan'] },
        { emoji: '🚈', keywords: ['light', 'rail', 'train', 'tram'] },
        { emoji: '🚂', keywords: ['locomotive', 'steam', 'train', 'old'] },
        { emoji: '🚃', keywords: ['railway', 'car', 'train', 'carriage'] },
        { emoji: '🚋', keywords: ['tram', 'car', 'trolley', 'streetcar'] },
        { emoji: '🚆', keywords: ['train', 'railway', 'transport', 'commute'] },
        { emoji: '🚇', keywords: ['metro', 'subway', 'underground', 'tube'] },
        { emoji: '🚊', keywords: ['tram', 'trolley', 'streetcar', 'public'] },
        { emoji: '🚍', keywords: ['oncoming', 'bus', 'transport', 'public'] },
        { emoji: '🚘', keywords: ['oncoming', 'automobile', 'car', 'vehicle'] },
        { emoji: '🚖', keywords: ['oncoming', 'taxi', 'cab', 'yellow'] },
        { emoji: '🚡', keywords: ['aerial', 'tramway', 'cable', 'car'] },
        { emoji: '🚠', keywords: ['mountain', 'cableway', 'gondola', 'ski'] },
        { emoji: '🚟', keywords: ['suspension', 'railway', 'monorail', 'hanging'] },
        { emoji: '⛵', keywords: ['sailboat', 'boat', 'sail', 'wind'] },
        { emoji: '🛶', keywords: ['canoe', 'boat', 'paddle', 'water'] },
        { emoji: '🚤', keywords: ['speedboat', 'boat', 'fast', 'water'] },
        { emoji: '🛥️', keywords: ['motor', 'boat', 'yacht', 'luxury'] },
        { emoji: '🛳️', keywords: ['passenger', 'ship', 'cruise', 'ocean'] },
        { emoji: '⛴️', keywords: ['ferry', 'boat', 'transport', 'water'] },
        { emoji: '🚢', keywords: ['ship', 'boat', 'ocean', 'cruise'] },
        { emoji: '⚓', keywords: ['anchor', 'ship', 'boat', 'harbor'] }
    ],
    objects: [
        { emoji: '💡', keywords: ['light', 'bulb', 'idea', 'bright'] },
        { emoji: '🔦', keywords: ['flashlight', 'torch', 'light', 'dark'] },
        { emoji: '🕯️', keywords: ['candle', 'light', 'flame', 'wax'] },
        { emoji: '🪔', keywords: ['diya', 'lamp', 'oil', 'light'] },
        { emoji: '🔥', keywords: ['fire', 'flame', 'hot', 'burn'] },
        { emoji: '💥', keywords: ['explosion', 'boom', 'blast', 'bang'] },
        { emoji: '💫', keywords: ['dizzy', 'star', 'sparkle', 'twinkle'] },
        { emoji: '⭐', keywords: ['star', 'favorite', 'rate', 'bright'] },
        { emoji: '🌟', keywords: ['glowing', 'star', 'sparkle', 'shine'] },
        { emoji: '✨', keywords: ['sparkles', 'magic', 'shine', 'glitter'] },
        { emoji: '⚡', keywords: ['lightning', 'bolt', 'electric', 'power'] },
        { emoji: '☄️', keywords: ['comet', 'space', 'tail', 'meteor'] },
        { emoji: '💎', keywords: ['diamond', 'gem', 'jewel', 'precious'] },
        { emoji: '🔮', keywords: ['crystal', 'ball', 'fortune', 'magic'] },
        { emoji: '📱', keywords: ['mobile', 'phone', 'cell', 'smartphone'] },
        { emoji: '📞', keywords: ['telephone', 'receiver', 'call', 'phone'] },
        { emoji: '☎️', keywords: ['telephone', 'phone', 'old', 'rotary'] },
        { emoji: '📟', keywords: ['pager', 'beeper', 'message', 'old'] },
        { emoji: '📠', keywords: ['fax', 'machine', 'document', 'send'] },
        { emoji: '🔋', keywords: ['battery', 'power', 'energy', 'charge'] },
        { emoji: '🔌', keywords: ['electric', 'plug', 'power', 'socket'] },
        { emoji: '💻', keywords: ['laptop', 'computer', 'pc', 'work'] },
        { emoji: '🖥️', keywords: ['desktop', 'computer', 'monitor', 'pc'] },
        { emoji: '🖨️', keywords: ['printer', 'print', 'document', 'paper'] },
        { emoji: '⌨️', keywords: ['keyboard', 'type', 'computer', 'keys'] },
        { emoji: '🖱️', keywords: ['computer', 'mouse', 'click', 'cursor'] },
        { emoji: '🖲️', keywords: ['trackball', 'computer', 'mouse', 'ball'] },
        { emoji: '💽', keywords: ['minidisc', 'cd', 'disk', 'storage'] },
        { emoji: '💾', keywords: ['floppy', 'disk', 'save', 'storage'] },
        { emoji: '💿', keywords: ['optical', 'disk', 'cd', 'music'] },
        { emoji: '📀', keywords: ['dvd', 'disk', 'movie', 'video'] },
        { emoji: '🧮', keywords: ['abacus', 'calculate', 'count', 'math'] },
        { emoji: '🎥', keywords: ['movie', 'camera', 'film', 'record'] },
        { emoji: '🎞️', keywords: ['film', 'frames', 'movie', 'cinema'] },
        { emoji: '📽️', keywords: ['film', 'projector', 'movie', 'cinema'] },
        { emoji: '🎬', keywords: ['clapper', 'board', 'movie', 'action'] },
        { emoji: '📺', keywords: ['television', 'tv', 'watch', 'screen'] },
        { emoji: '📷', keywords: ['camera', 'photo', 'picture', 'snap'] },
        { emoji: '📸', keywords: ['camera', 'flash', 'photo', 'picture'] },
        { emoji: '📹', keywords: ['video', 'camera', 'record', 'film'] },
        { emoji: '📼', keywords: ['videocassette', 'vhs', 'tape', 'old'] },
        { emoji: '🔍', keywords: ['magnifying', 'glass', 'search', 'zoom'] },
        { emoji: '🔎', keywords: ['magnifying', 'glass', 'right', 'search'] },
        { emoji: '🕯️', keywords: ['candle', 'light', 'flame', 'romantic'] },
        { emoji: '💡', keywords: ['bulb', 'idea', 'light', 'innovation'] },
        { emoji: '🔦', keywords: ['flashlight', 'torch', 'beam', 'dark'] },
        { emoji: '🏮', keywords: ['red', 'paper', 'lantern', 'chinese'] },
        { emoji: '📔', keywords: ['notebook', 'decorated', 'cover', 'write'] },
        { emoji: '📕', keywords: ['closed', 'book', 'red', 'read'] },
        { emoji: '📖', keywords: ['open', 'book', 'read', 'study'] },
        { emoji: '📗', keywords: ['green', 'book', 'read', 'study'] },
        { emoji: '📘', keywords: ['blue', 'book', 'read', 'study'] },
        { emoji: '📙', keywords: ['orange', 'book', 'read', 'study'] },
        { emoji: '📚', keywords: ['books', 'stack', 'study', 'library'] },
        { emoji: '📓', keywords: ['notebook', 'write', 'notes', 'study'] },
        { emoji: '📒', keywords: ['ledger', 'notebook', 'write', 'accounts'] },
        { emoji: '📃', keywords: ['page', 'curling', 'document', 'paper'] },
        { emoji: '📜', keywords: ['scroll', 'paper', 'document', 'old'] },
        { emoji: '📄', keywords: ['page', 'facing', 'up', 'document'] },
        { emoji: '📰', keywords: ['newspaper', 'news', 'read', 'paper'] },
        { emoji: '🗞️', keywords: ['rolled', 'newspaper', 'news', 'paper'] },
        { emoji: '📑', keywords: ['bookmark', 'tabs', 'organize', 'mark'] },
        { emoji: '🔖', keywords: ['bookmark', 'mark', 'tag', 'save'] },
        { emoji: '🏷️', keywords: ['label', 'tag', 'price', 'mark'] }
    ],
    symbols: [
        { emoji: '❤️', keywords: ['heart', 'love', 'like', 'affection'] },
        { emoji: '🧡', keywords: ['orange', 'heart', 'love', 'warm'] },
        { emoji: '💛', keywords: ['yellow', 'heart', 'love', 'friendship'] },
        { emoji: '💚', keywords: ['green', 'heart', 'love', 'nature'] },
        { emoji: '💙', keywords: ['blue', 'heart', 'love', 'trust'] },
        { emoji: '💜', keywords: ['purple', 'heart', 'love', 'magic'] },
        { emoji: '🖤', keywords: ['black', 'heart', 'dark', 'evil'] },
        { emoji: '🤍', keywords: ['white', 'heart', 'pure', 'clean'] },
        { emoji: '🤎', keywords: ['brown', 'heart', 'earth', 'nature'] },
        { emoji: '💔', keywords: ['broken', 'heart', 'sad', 'breakup'] },
        { emoji: '❣️', keywords: ['heart', 'exclamation', 'love', 'emphasis'] },
        { emoji: '💕', keywords: ['two', 'hearts', 'love', 'affection'] },
        { emoji: '💞', keywords: ['revolving', 'hearts', 'love', 'romance'] },
        { emoji: '💓', keywords: ['beating', 'heart', 'love', 'pulse'] },
        { emoji: '💗', keywords: ['growing', 'heart', 'love', 'expanding'] },
        { emoji: '💖', keywords: ['sparkling', 'heart', 'love', 'shine'] },
        { emoji: '💘', keywords: ['heart', 'arrow', 'cupid', 'love'] },
        { emoji: '💝', keywords: ['heart', 'ribbon', 'gift', 'present'] },
        { emoji: '💟', keywords: ['heart', 'decoration', 'love', 'ornament'] },
        { emoji: '☮️', keywords: ['peace', 'symbol', 'hippie', 'calm'] },
        { emoji: '✝️', keywords: ['latin', 'cross', 'christian', 'religion'] },
        { emoji: '☪️', keywords: ['star', 'crescent', 'islam', 'muslim'] },
        { emoji: '🕉️', keywords: ['om', 'hindu', 'buddhist', 'symbol'] },
        { emoji: '☸️', keywords: ['wheel', 'dharma', 'buddhist', 'religion'] },
        { emoji: '✡️', keywords: ['star', 'david', 'jewish', 'judaism'] },
        { emoji: '🔯', keywords: ['dotted', 'six', 'pointed', 'star'] },
        { emoji: '🕎', keywords: ['menorah', 'jewish', 'candles', 'hanukkah'] },
        { emoji: '☯️', keywords: ['yin', 'yang', 'balance', 'taoism'] },
        { emoji: '☦️', keywords: ['orthodox', 'cross', 'christian', 'religion'] },
        { emoji: '🛐', keywords: ['place', 'worship', 'religion', 'pray'] },
        { emoji: '⛎', keywords: ['ophiuchus', 'zodiac', 'constellation', 'snake'] },
        { emoji: '♈', keywords: ['aries', 'zodiac', 'ram', 'astrology'] },
        { emoji: '♉', keywords: ['taurus', 'zodiac', 'bull', 'astrology'] },
        { emoji: '♊', keywords: ['gemini', 'zodiac', 'twins', 'astrology'] },
        { emoji: '♋', keywords: ['cancer', 'zodiac', 'crab', 'astrology'] },
        { emoji: '♌', keywords: ['leo', 'zodiac', 'lion', 'astrology'] },
        { emoji: '♍', keywords: ['virgo', 'zodiac', 'maiden', 'astrology'] },
        { emoji: '♎', keywords: ['libra', 'zodiac', 'scales', 'astrology'] },
        { emoji: '♏', keywords: ['scorpio', 'zodiac', 'scorpion', 'astrology'] },
        { emoji: '♐', keywords: ['sagittarius', 'zodiac', 'archer', 'astrology'] },
        { emoji: '♑', keywords: ['capricorn', 'zodiac', 'goat', 'astrology'] },
        { emoji: '♒', keywords: ['aquarius', 'zodiac', 'water', 'bearer'] },
        { emoji: '♓', keywords: ['pisces', 'zodiac', 'fish', 'astrology'] },
        { emoji: '🆔', keywords: ['id', 'button', 'identity', 'identification'] },
        { emoji: '⚛️', keywords: ['atom', 'symbol', 'science', 'physics'] },
        { emoji: '🉑', keywords: ['japanese', 'acceptable', 'button', 'ok'] },
        { emoji: '☢️', keywords: ['radioactive', 'nuclear', 'danger', 'warning'] },
        { emoji: '☣️', keywords: ['biohazard', 'danger', 'warning', 'toxic'] },
        { emoji: '📴', keywords: ['mobile', 'phone', 'off', 'silence'] },
        { emoji: '📳', keywords: ['vibration', 'mode', 'phone', 'silent'] },
        { emoji: '🈶', keywords: ['japanese', 'not', 'free', 'charge'] },
        { emoji: '🈚', keywords: ['japanese', 'free', 'charge', 'button'] },
        { emoji: '🈸', keywords: ['japanese', 'application', 'button', 'form'] },
        { emoji: '🈺', keywords: ['japanese', 'open', 'business', 'button'] },
        { emoji: '🈷️', keywords: ['japanese', 'monthly', 'amount', 'button'] },
        { emoji: '✴️', keywords: ['eight', 'pointed', 'star', 'sparkle'] },
        { emoji: '🆚', keywords: ['vs', 'button', 'versus', 'against'] },
        { emoji: '💮', keywords: ['white', 'flower', 'japanese', 'well', 'done'] },
        { emoji: '🉐', keywords: ['japanese', 'bargain', 'button', 'deal'] },
        { emoji: '㊙️', keywords: ['japanese', 'secret', 'button', 'hidden'] },
        { emoji: '㊗️', keywords: ['japanese', 'congratulations', 'button', 'celebrate'] },
        { emoji: '🈴', keywords: ['japanese', 'passing', 'grade', 'button'] },
        { emoji: '🈵', keywords: ['japanese', 'no', 'vacancy', 'button'] },
        { emoji: '🈹', keywords: ['japanese', 'discount', 'button', 'sale'] },
        { emoji: '🈲', keywords: ['japanese', 'prohibited', 'button', 'forbidden'] },
        { emoji: '🅰️', keywords: ['a', 'button', 'blood', 'type'] },
        { emoji: '🅱️', keywords: ['b', 'button', 'blood', 'type'] },
        { emoji: '🆎', keywords: ['ab', 'button', 'blood', 'type'] },
        { emoji: '🆑', keywords: ['cl', 'button', 'clear', 'clean'] },
        { emoji: '🅾️', keywords: ['o', 'button', 'blood', 'type'] },
        { emoji: '🆘', keywords: ['sos', 'button', 'help', 'emergency'] }
    ]
};

// Emoji picker functionality
let currentEmojiCategory = 'smileys';

function toggleEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    const isVisible = emojiPicker.style.display !== 'none';
    
    if (isVisible) {
        hideEmojiPicker();
    } else {
        showEmojiPicker();
    }
}

function showEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    emojiPicker.style.display = 'flex';
    
    // Load initial category
    loadEmojiCategory(currentEmojiCategory);
    
    // Setup event listeners
    setupEmojiPickerListeners();
}

function hideEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    emojiPicker.style.display = 'none';
}

function setupEmojiPickerListeners() {
    // Tab click handlers
    document.querySelectorAll('.emoji-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const category = e.target.dataset.category;
            switchEmojiCategory(category);
        });
    });
    
    // Search input handler
    const searchInput = document.getElementById('emojiSearch');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (query) {
            searchEmojis(query);
        } else {
            loadEmojiCategory(currentEmojiCategory);
        }
    });
    
    // Click outside to close
    document.addEventListener('click', handleEmojiPickerOutsideClick);
}

function handleEmojiPickerOutsideClick(e) {
    const emojiPicker = document.getElementById('emojiPicker');
    const emojiButton = document.getElementById('emojiButton');
    
    if (emojiPicker.style.display !== 'none' && 
        !emojiPicker.contains(e.target) && 
        !emojiButton.contains(e.target)) {
        hideEmojiPicker();
        document.removeEventListener('click', handleEmojiPickerOutsideClick);
    }
}

function switchEmojiCategory(category) {
    currentEmojiCategory = category;
    
    // Update active tab
    document.querySelectorAll('.emoji-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`).classList.add('active');
    
    // Load category emojis
    loadEmojiCategory(category);
    
    // Clear search
    document.getElementById('emojiSearch').value = '';
}

function loadEmojiCategory(category) {
    const emojiContent = document.getElementById('emojiContent');
    const emojis = emojiData[category] || [];
    
    emojiContent.innerHTML = '';
    
    emojis.forEach(emojiObj => {
        const emojiButton = document.createElement('button');
        emojiButton.className = 'emoji-item';
        emojiButton.textContent = emojiObj.emoji;
        emojiButton.title = emojiObj.keywords.join(', ');
        emojiButton.addEventListener('click', () => insertEmoji(emojiObj.emoji));
        emojiContent.appendChild(emojiButton);
    });
}

function searchEmojis(query) {
    const emojiContent = document.getElementById('emojiContent');
    const allEmojis = [];
    
    // Collect all emojis from all categories
    Object.values(emojiData).forEach(categoryEmojis => {
        allEmojis.push(...categoryEmojis);
    });
    
    // Filter emojis by search query
    const filteredEmojis = allEmojis.filter(emojiObj => 
        emojiObj.keywords.some(keyword => keyword.includes(query))
    );
    
    emojiContent.innerHTML = '';
    
    if (filteredEmojis.length === 0) {
        emojiContent.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #666; padding: 20px;">No emojis found</div>';
        return;
    }
    
    filteredEmojis.forEach(emojiObj => {
        const emojiButton = document.createElement('button');
        emojiButton.className = 'emoji-item';
        emojiButton.textContent = emojiObj.emoji;
        emojiButton.title = emojiObj.keywords.join(', ');
        emojiButton.addEventListener('click', () => insertEmoji(emojiObj.emoji));
        emojiContent.appendChild(emojiButton);
    });
}

function insertEmoji(emoji) {
    const messageInput = document.getElementById('messageInput');
    const currentValue = messageInput.value;
    const cursorPosition = messageInput.selectionStart;
    
    // Insert emoji at cursor position
    const newValue = currentValue.slice(0, cursorPosition) + emoji + currentValue.slice(cursorPosition);
    messageInput.value = newValue;
    
    // Update cursor position
    const newCursorPosition = cursorPosition + emoji.length;
    messageInput.setSelectionRange(newCursorPosition, newCursorPosition);
    
    // Update send button state and input height
    updateSendButtonState();
    
    // Trigger input event for height adjustment
    const inputEvent = new Event('input', { bubbles: true });
    messageInput.dispatchEvent(inputEvent);
    
    // Focus back to input
    messageInput.focus();
}


