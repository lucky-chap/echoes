# Echoes consolidated verification

Generated 2026-10-30T08:40:52.642Z.

Demo profile birth years and notes are unchanged: Dorothy 1944, Margaret 1946, Robert 1950.

The diagnosis and full before-ranking tables are in [echoes-consolidated-diagnosis.md](echoes-consolidated-diagnosis.md). This file records the final provider-backed kits, including cached responses. The browser verifier loads those actual kits into a separate temporary protected workspace; it does not invent discovery results.

Evidence JSON: /tmp/echoes-three-consolidated-final.json. SHA-256: `09ac5e5667ee97fbbeef8845fcb9c6639c4ad18cd9f6f22adc975ab1d9e7631d`.

## What changed

- Qloo name-search records were missing notable songs. The verified Insights lookup using filter.results.entities, without self-interest exclusion, supplies those fields before ranking favourites.
- Ranking uses Qloo notable-song match, known official release count, widely-released evidence, then year. A two-release lead (N = 2) is sufficient without a notable match. Unknown is never zero. Unknown top or runner-up counts, or a lead below two, produce an artist invitation when there is no notable match.
- All in-window singles remain in the ranking table. Up to 12 previously unknown release groups per artist are checked per run, deduplicated, throttled to at most one MusicBrainz request per second and cached. Existing known counts do not consume that request allowance. Failed and malformed count responses are not cached as successful results.
- Artist invitations show the era window in review, overview, swaps and live-session badges. Date badges now use 14px text rather than 8px.
- Swap qualification records genre, region and Qloo-neighbourhood evidence. It excludes current running-order items, unsafe alternatives and out-of-window alternatives, requires two options and caps lists at three. Rock-and-roll swaps need matching rock-and-roll/rockabilly evidence. The date budget reserves two additional music checks after 16 independent checks, within the existing overall tool/time bounds; publication years already present in Qloo book payloads do not consume independent-provider checks.
- The planner reserves a related earlier screen discovery when a named screen favourite starts late in the window. This restores Robert’s Dick Van Dyke item without replacing his named favourite.
- Named favourites with provider keyword matches remain visible with the matched term, source field and avoid topic. Discoveries remain strict. The conservative default is separately identified when it excludes content.
- UK/US music searches resolve the real British/American genre tags and supplement the seed searches. Film/TV requests retain country filters. Artist start dates prioritize independent date checks; they never approve a release on their own.
- Confirmed cooking specifics, music-attached movement and choir invitations are preserved. Prompt tails are checked for duplicates, including during swaps. Logistics are capitalized and punctuated in the plan and Tips.

## ListenBrainz check

The documented per-artist top-recordings endpoint returned HTTP 401 (authentication required). Its rate-limit headers allowed 30 requests per window, with 29 remaining and reset-in 1; authentication, not the rate limit, was the blocker. No ListenBrainz token is configured, so no ListenBrainz popularity signal is claimed or fabricated. See the [official popularity API documentation](https://listenbrainz.readthedocs.io/en/latest/users/api/popularity.html).

## Cache behaviour and Dusty’s formerly missing counts

Successful provider responses persist for 30 days in .echoes-data/provider-cache, with SHA-256 filenames derived from logical keys. HTTP/network/parse failures are not written. A malformed legacy count response is ignored and retried; it cannot overwrite a known count. A valid provider count of zero remains zero.

Count key: `MusicBrainz:https://musicbrainz.org/ws/2/release/?release-group=<MBID>&limit=1&status=official&fmt=json`. Catalogue key: `years:v5:urn:entity:artist:<normalized artist>:<linked MBID>`. Resolved identity key: `Qloo:resolved-search:<type>:<normalized name without spaces>`. Enrichment responses use `Qloo:<full /v2/insights URL>`.

The previous table already had a known count of 1 for I Only Want to Be With You / Once Upon a Time. You Don’t Have to Say You Love Me was marked outside_cap, not a title-match failure. Previously, already-cached early candidates consumed the 12-target shortlist again. The new allowance applies to unknown counts, and notable-song metadata prioritizes the relevant singles. Both counts are now known; the table below records the resulting choice.

## Final ranking candidate tables

### Aretha Franklin — Dorothy

Choice: (You Make Me Feel Like) A Natural Woman. Decision: Qloo notable-song match. Popularity coverage incomplete: false.

|Rank|Candidate|Year|Qloo notable|Official releases|Widely released|Count status|Selected|
|---:|---|---:|---|---:|---|---|---|
|1|(You Make Me Feel Like) A Natural Woman / Baby, Baby, Baby|1967|true|2|false|known|true|
|2|Chain of Fools / Prove It|1967|true|2|false|known|false|
|3|The House That Jack Built / I Say a Little Prayer|1968|true|2|false|known|false|
|4|(I Can't Get No) Satisfaction / Chain Of Fools|1967|true|1|false|known|false|
|5|Think|1968|true|1|false|known|false|
|6|I Say a Little Prayer / See-Saw|1968|true|1|false|known|false|
|7|Ain’t No Way / Do Right Woman – Do Right Man|1968|true|1|false|known|false|
|8|I Never Loved a Man (the Way I Love You)|1967|false|2|false|known|false|
|9|Eleanor Rigby / It Ain’t Fair|1969|false|2|false|known|false|
|10|Are You Sure / Maybe I'm A Fool|1961|false|1|false|known|false|
|11|Rock-A-Bye Your Baby With A Dixie Melody / Operation Heartbreak|1961|false|1|false|known|false|
|12|One Step Ahead / I Can’t Wait Until I See My Baby’s Face|1965|false|1|false|known|false|
|13|Cry Like a Baby / Swanee|1966|false|1|false|known|false|
|14|Hands Off / Tighten Up Your Tie, Button Up Your Jacket (Make It for the Door)|1966|false|1|false|known|false|
|15|Baby I Love You / Going Down Slow|1967|false|1|false|known|false|
|16|(Sweet Sweet Baby) Since You’ve Been Gone|1968|false|1|false|known|false|
|17|See Saw / My Song|1968|false|1|false|known|false|
|18|Share Your Love With Me / Pledging My Love|1969|false|1|false|known|false|
|19|I Can’t See Myself Leaving You|1969|false|1|false|known|false|
|20|The Weight / Tracks of My Tears|1969|false|1|false|known|false|
|21|The Christmas Song (Chestnuts Roasting on an Open Fire) / Winter Wonderland|1964|false|0|false|known|false|

### Elvis Presley — Dorothy

Choice: Blue Suede Shoes. Decision: Qloo notable-song match. Popularity coverage incomplete: true.

|Rank|Candidate|Year|Qloo notable|Official releases|Widely released|Count status|Selected|
|---:|---|---:|---|---:|---|---|---|
|1|Blue Suede Shoes / Tutti Frutti|1956|true|6|true|known|true|
|2|Love Me Tender / Any Way You Want Me (That’s How I Will Be)|1956|true|6|true|known|false|
|3|Heartbreak Hotel|1956|true|5|true|known|false|
|4|Jailhouse Rock|1957|true|4|false|known|false|
|5|All Shook Up / That’s When Your Heartaches Begin|1957|true|4|false|known|false|
|6|Hound Dog / Don’t Be Cruel|1956|true|3|false|known|false|
|7|Can’t Help Falling in Love / Rock‐A‐Hula Baby|1961|true|2|false|known|false|
|8|Suspicious Minds|1969|true|2|false|known|false|
|9|Are You Lonesome Tonight? / I Gotta Know|1960|true|1|false|known|false|
|10|A Little Less Conversation / Almost in Love|1968|true|1|false|known|false|
|11|In the Ghetto / Any Day Now|1969|true|1|false|known|false|
|12|In The Ghetto|1969|true|1|false|known|false|
|13|Blue Suede Shoes / I'm Counting on You|1956|true|0|false|known|false|
|14|One Night / I Got Stung|1958|false|5|true|known|false|
|15|Don’t / I Beg of You|1957|false|3|false|known|false|
|16|I'm Left, You're Right, She's Gone / Baby Let's Play House|1957|false|3|false|known|false|
|17|Too Much / Playing for Keeps|1957|false|3|false|known|false|
|18|(Marie's the Name) His Latest Flame|1961|false|3|false|known|false|
|19|I Don’t Care If the Sun Don’t Shine / Good Rockin’ Tonight|1954|false|2|false|known|false|
|20|Good Rockin’ Tonight / I Don’t Care If the Sun Don’t Shine|1954|false|2|false|known|false|
|21|Mystery Train / I Forgot to Remember to Forget|1955|false|2|false|known|false|
|22|Tryin’ to Get to You / I Love You Because|1956|false|2|false|known|false|
|23|I Want You, I Need You, I Love You / My Baby Left Me|1956|false|2|false|known|false|
|24|(Let Me Be Your) Teddy Bear / Loving You|1957|false|2|false|known|false|
|25|Hard Headed Woman / Don't Ask Me Why|1958|false|2|false|known|false|
|26|Wear My Ring Around Your Neck / Doncha’ Think It’s Time|1958|false|2|false|known|false|
|27|I Need Your Love Tonight / A Fool Such As I|1959|false|2|false|known|false|
|28|A Big Hunk o’ Love / My Wish Came True|1959|false|2|false|known|false|
|29|It’s Now or Never|1960|false|2|false|known|false|
|30|It’s Now or Never / A Mess of Blues|1960|false|2|false|known|false|
|31|The Girl of My Best Friend / A Mess of Blues|1960|false|2|false|known|false|
|32|I Feel So Bad / Wild in the Country|1961|false|2|false|known|false|
|33|Wooden Heart|1961|false|2|false|known|false|
|34|Return to Sender / Where Do You Come From|1962|false|2|false|known|false|
|35|Kiss Me Quick|1963|false|2|false|known|false|
|36|That’s All Right / Blue Moon of Kentucky|1954|false|1|false|known|false|
|37|Baby Let’s Play House / I’m Left, You’re Right, She’s Gone|1955|false|1|false|known|false|
|38|You’re a Heartbreaker / Milkcow Blues Boogie|1955|false|1|false|known|false|
|39|I Got a Woman / I'm Counting on You|1956|false|1|false|known|false|
|40|Blue Moon / Just Because|1956|false|1|false|known|false|
|41|Shake, Rattle and Roll|1956|false|1|false|known|false|
|42|I'm Gonna Sit Right Down and Cry (Over You) / I'll Never Let You Go (Little Darlin')|1956|false|1|false|known|false|
|43|Money Honey / One-Sided Love Affair|1956|false|1|false|known|false|
|44|Party / Got A Lot O' Livin' To Do|1957|false|1|false|known|false|
|45|Santa Bring My Baby Back (To Me) / Santa Claus Is Back in Town|1957|false|1|false|known|false|
|46|Paralyzed / When My Blue Moon Turns To Gold Again|1957|false|1|false|known|false|
|47|King Creole / Dixieland Rock|1958|false|1|false|known|false|
|48|Don't (7")|1958|false|1|false|known|false|
|49|A Big Hunk o’ Love|1959|false|1|false|known|false|
|50|Stuck on You / Fame and Fortune|1960|false|1|false|known|false|
|51|O Sole Mio (It's Now or Never)|1960|false|1|false|known|false|
|52|Fever / Dirty Dirty Feeling|1960|false|1|false|known|false|
|53|Surrender / Lonely Man|1961|false|1|false|known|false|
|54|His Latest Flame / Little Sister|1961|false|1|false|known|false|
|55|La Paloma (No More)|1962|false|1|false|known|false|
|56|She’s Not You / Just Tell Her Jim Said Hello|1962|false|1|false|known|false|
|57|Good Luck Charm / Anything That’s Part of You|1962|false|1|false|known|false|
|58|Bossa Nova Baby|1963|false|1|false|known|false|
|59|Mexico / You Can’t Say No in Acapulco|1963|false|1|false|known|false|
|60|One Broken Heart for Sale|1963|false|1|false|known|false|
|61|(You’re the) Devil in Disguise / Please Don’t Drag That String Around|1963|false|1|false|known|false|
|62|In My Fathers House / I Believe in the Man in the Sky|1963|false|1|false|known|false|
|63|One Broken Heart for Sale / They Remind Me Too Much of You|1963|false|1|false|known|false|
|64|(Such an) Easy Question / It Feels So Right|1965|false|1|false|known|false|
|65|Ain't That Loving You Baby / Ask Me|1964|false|unknown|false|unknown|false|
|66|Viva Las Vegas|1964|false|unknown|false|unknown|false|
|67|Silent Night / White Christmas|1964|false|unknown|false|unknown|false|
|68|Such A Night / Never Ending|1964|false|unknown|false|unknown|false|
|69|Blue Christmas|1964|false|unknown|false|unknown|false|
|70|Kissin' Cousins|1964|false|unknown|false|unknown|false|
|71|Crying In The Chapel|1965|false|unknown|false|unknown|false|
|72|Puppet On A String / Wooden Heart|1965|false|unknown|false|unknown|false|
|73|Do the Clam|1965|false|unknown|false|unknown|false|
|74|Tell Me Why|1965|false|unknown|false|unknown|false|
|75|I’m Yours / (It’s a) Long Lonely Highway|1965|false|unknown|false|unknown|false|
|76|Frankie and Johnny / Please Don’t Stop Loving Me|1966|false|unknown|false|unknown|false|
|77|If Every Day Was Like Christmas|1966|false|unknown|false|outside_cap|false|
|78|Blue River / Do Not Disturb|1966|false|unknown|false|outside_cap|false|
|79|Love Letters / Come What May|1966|false|unknown|false|outside_cap|false|
|80|All That I Am / Spinout|1966|false|unknown|false|outside_cap|false|
|81|Spinout / All That I Am|1966|false|unknown|false|outside_cap|false|
|82|There’s Always Me / Judy|1967|false|unknown|false|outside_cap|false|
|83|Indescribably Blue / Fools Fall in Love|1967|false|unknown|false|outside_cap|false|
|84|Long Legged Girl (With the Short Dress On)|1967|false|unknown|false|outside_cap|false|
|85|The Love Machine / You Gotta Stop|1967|false|unknown|false|outside_cap|false|
|86|You Don’t Know Me / Big Boss Man|1967|false|unknown|false|outside_cap|false|
|87|If I Can Dream / Edge of Reality|1968|false|unknown|false|outside_cap|false|
|88|Your Time Hasn't Come Yet, Baby / Let Yourself Go|1968|false|unknown|false|outside_cap|false|
|89|We Call on Him / You'll Never Walk Alone|1968|false|unknown|false|outside_cap|false|
|90|U.S. Male / Stay Away|1968|false|unknown|false|outside_cap|false|
|91|Guitar Man / High Heel Sneakers|1968|false|unknown|false|outside_cap|false|
|92|Don't Cry Daddy / Rubberneckin'|1969|false|unknown|false|outside_cap|false|
|93|Clean Up Your Own Back Yard / The Fair Is Moving On|1969|false|unknown|false|outside_cap|false|
|94|Charro / Memories|1969|false|unknown|false|outside_cap|false|
|95|I Got Stung / One Night|1969|false|unknown|false|outside_cap|false|
|96|If I Can Dream|1969|false|unknown|false|outside_cap|false|

### The Beatles — Margaret

Choice: Help!. Decision: Qloo notable-song match. Popularity coverage incomplete: true.

|Rank|Candidate|Year|Qloo notable|Official releases|Widely released|Count status|Selected|
|---:|---|---:|---|---:|---|---|---|
|1|Help! / I’m Down|1965|true|35|true|known|true|
|2|She Loves You / I’ll Get You|1963|true|23|true|known|false|
|3|I Want to Hold Your Hand / I Saw Her Standing There|1963|true|23|true|known|false|
|4|Yesterday / Act Naturally|1965|true|20|true|known|false|
|5|I Want to Hold Your Hand / This Boy|1963|true|15|true|known|false|
|6|Hey Jude / Revolution|1968|true|9|true|known|false|
|7|Strawberry Fields Forever / Penny Lane|1967|true|7|true|known|false|
|8|Let It Be|1970|true|7|true|known|false|
|9|Yellow Submarine / Eleanor Rigby|1966|true|5|true|known|false|
|10|All You Need Is Love|1967|true|5|true|known|false|
|11|Something / Come Together|1969|true|5|true|known|false|
|12|Octopus’s Garden / Something / Come Together|1969|true|0|false|known|false|
|13|Love Me Do / P.S. I Love You|1962|false|33|true|known|false|
|14|We Can Work It Out / Day Tripper|1965|false|33|true|known|false|
|15|Can’t Buy Me Love / You Can't Do That|1964|false|27|true|known|false|
|16|Ticket to Ride / Yes It Is|1965|false|27|true|known|false|
|17|I Feel Fine / She’s a Woman|1964|false|23|true|known|false|
|18|Twist and Shout / There’s a Place|1964|false|23|true|known|false|
|19|A Hard Day’s Night / I Should Have Known Better|1964|false|21|true|known|false|
|20|Please Please Me / From Me to You|1964|false|19|true|known|false|
|21|Please Please Me / Ask Me Why|1963|false|18|true|known|false|
|22|Nowhere Man / What Goes On|1966|false|18|true|known|false|
|23|And I Love Her / If I Fell|1964|false|17|true|known|false|
|24|From Me to You / Thank You Girl|1963|false|16|true|known|false|
|25|Matchbox / Slow Down|1964|false|14|true|known|false|
|26|Eight Days a Week / I Don’t Want to Spoil the Party|1965|false|14|true|known|false|
|27|Do You Want to Know a Secret / Thank You Girl|1964|false|13|true|known|false|
|28|I’ll Cry Instead / I’m Happy Just to Dance With You|1964|false|13|true|known|false|
|29|A Hard Day’s Night / Things We Said Today|1964|false|9|true|known|false|
|30|Lady Madonna / The Inner Light|1968|false|8|true|known|false|
|31|Get Back / Don’t Let Me Down|1969|false|6|true|known|false|
|32|Ain’t She Sweet|1964|false|5|true|known|false|
|33|Paperback Writer / Rain|1966|false|5|true|known|false|
|34|The Ballad of John and Yoko|1969|false|5|true|known|false|
|35|Sie liebt dich / I’ll Get You|1964|false|4|true|known|false|
|36|Till There Was You|1964|false|3|false|known|false|
|37|Komm gib mir deine Hand / Sie liebt dich|1964|false|2|false|known|false|
|38|I Saw Her Standing There|1964|false|2|false|known|false|
|39|I Should Have Known Better / You Really Gotta Hold on Me|1964|false|2|false|known|false|
|40|The Beatles’ Christmas Record|1963|false|1|false|known|false|
|41|Roll Over Beethoven / Please Mr. Postman|1963|false|1|false|known|false|
|42|Roll Over Beethoven / Hold Me Tight|1964|false|1|false|known|false|
|43|I Should Have Known Better|1964|false|1|false|known|false|
|44|I’ll Get You|1964|false|1|false|known|false|
|45|All My Loving / I Wanna Be Your Man|1964|false|1|false|known|false|
|46|Any Time At All|1964|false|1|false|known|false|
|47|Cry for a Shadow|1964|false|unknown|false|unknown|false|
|48|Why|1964|false|unknown|false|unknown|false|
|49|Misery / Ask Me Why|1964|false|unknown|false|unknown|false|
|50|All My Loving / This Boy|1964|false|unknown|false|unknown|false|
|51|Ain’t She Sweet|1964|false|unknown|false|unknown|false|
|52|Sweet Georgia Brown|1964|false|unknown|false|unknown|false|
|53|Anna / Ask Me Why|1964|false|unknown|false|unknown|false|
|54|Rock and Roll Music / I'm a Loser|1965|false|unknown|false|unknown|false|
|55|You're Going To Lose That Girl / Tell Me What You See|1965|false|unknown|false|unknown|false|
|56|Sweet Georgia Brown|1965|false|unknown|false|unknown|false|
|57|No Reply / Rock and Roll Music|1965|false|unknown|false|unknown|false|
|58|Rock and Roll Music|1965|false|unknown|false|unknown|false|
|59|I'll Follow The Sun / I Don't Want to Spoil The Party|1965|false|unknown|false|outside_cap|false|
|60|Roll Over Beethoven / Misery|1965|false|unknown|false|outside_cap|false|
|61|Boys|1965|false|unknown|false|outside_cap|false|
|62|Pantomime: “Everywhere It’s Christmas”|1966|false|unknown|false|outside_cap|false|
|63|Michelle|1966|false|unknown|false|outside_cap|false|
|64|Run for Your Life / Michelle|1966|false|unknown|false|outside_cap|false|
|65|Nowhere Man / Norwegian Wood (This Bird Has Flown)|1966|false|unknown|false|outside_cap|false|
|66|The Fool on the Hill|1967|false|unknown|false|outside_cap|false|
|67|Christmas Time (Is Here Again)|1967|false|unknown|false|outside_cap|false|
|68|Ob-La-Di, Ob-La-Da|1968|false|unknown|false|outside_cap|false|
|69|The Long and Winding Road|1970|false|unknown|false|outside_cap|false|

### Stevie Wonder — Robert

Choice: Signed, Sealed, Delivered I’m Yours. Decision: Qloo notable-song match. Popularity coverage incomplete: false.

|Rank|Candidate|Year|Qloo notable|Official releases|Widely released|Count status|Selected|
|---:|---|---:|---|---:|---|---|---|
|1|Signed, Sealed, Delivered I’m Yours / I’m More Than Happy (I’m Satisfied)|1970|true|2|false|known|true|
|2|Superstition|1972|true|2|false|known|false|
|3|Uptight (Everything’s Alright)|1965|true|1|false|known|false|
|4|For Once in My Life|1968|true|1|false|known|false|
|5|Fingertips|1963|false|15|true|known|false|
|6|Alfie / More Than a Dream|1967|false|3|false|known|false|
|7|Boogie On Reggae Woman|1974|false|2|false|known|false|
|8|I’m Wondering / Every Time I See You I Go Wild|1967|false|1|false|known|false|
|9|I Was Made to Love Her|1967|false|1|false|known|false|
|10|Heaven Help us All|1970|false|1|false|known|false|
|11|You Are the Sunshine of My Life \ Tuesday Heartbreak|1973|false|1|false|known|false|
|12|Don’t You Worry ’Bout a Thing|1974|false|1|false|known|false|
|13|Hey Harmonica Man|1964|false|0|false|known|false|

### Carole King — Robert

Choice: It's Too Late. Decision: Qloo notable-song match. Popularity coverage incomplete: false.

|Rank|Candidate|Year|Qloo notable|Official releases|Widely released|Count status|Selected|
|---:|---|---:|---|---:|---|---|---|
|1|It's Too Late / I Feel the Earth Move|1971|true|21|true|known|true|
|2|So Far Away / Smackwater Jack|1971|true|11|true|known|false|
|3|You've Got a Friend / Beautiful|1971|true|2|false|known|false|
|4|Up on the Roof / Eventually|1970|true|1|false|known|false|
|5|It Might as Well Rain Until September / Nobody’s Perfect|1962|false|19|true|known|false|
|6|Sweet Seasons / Pocket Money|1972|false|15|true|known|false|
|7|Corazón / That’s How Things Go Down|1973|false|15|true|known|false|
|8|Jazzman / You Go Your Way, I’ll Go Mine|1974|false|14|true|known|false|
|9|You Light Up My Life / Believe in Humanity|1973|false|13|true|known|false|
|10|Been to Canaan / Bitter With the Sweet|1972|false|12|true|known|false|
|11|Nightingale / You’re Something New|1974|false|6|true|known|false|
|12|Only Love Is Real / Still Here Thinking of You|1975|false|6|true|known|false|
|13|A Road to Nowhere / Some of Your Lovin’|1966|false|3|true|known|false|
|14|High Out of Time / I’d Like to Know You Better|1975|false|3|false|known|false|
|15|He’s a Bad Boy / We Grew Up Together|1963|false|2|false|known|false|
|16|Oh, Neil / A Very Special Boy|1960|false|1|false|known|false|
|17|School Bells Are Ringing / I Didn’t Have Any Summer Romance|1962|false|1|false|known|false|

### Dusty Springfield — Margaret

Choice: You Don’t Have to Say You Love Me. Decision: Qloo notable-song match. Popularity coverage incomplete: false.

|Rank|Candidate|Year|Qloo notable|Official releases|Widely released|Count status|Selected|
|---:|---|---:|---|---:|---|---|---|
|1|You Don’t Have to Say You Love Me|1966|true|2|false|known|true|
|2|I Only Want to Be With You / Once Upon a Time|1963|true|1|false|known|false|
|3|Wishin’ and Hopin’|1964|true|1|false|known|false|
|4|Wishin’ and Hopin’ / Everyday I Have to Cry|1964|true|1|false|known|false|
|5|Son‐of‐a Preacher Man|1968|true|1|false|known|false|
|6|Stay Awhile / Something Special|1964|false|2|false|known|false|
|7|I Just Don’t Know What to Do With Myself / My Colouring Book|1964|false|2|false|known|false|
|8|Some of Your Lovin'|1965|false|2|false|known|false|
|9|All Cried Out / I Wish I Never Loved You|1964|false|1|false|known|false|
|10|Warten und hoffen / Auf dich nur wart’ ich immerzu|1964|false|1|false|known|false|
|11|Tanto so che poi mi passa / Stupido stupido|1964|false|1|false|known|false|
|12|In the Middle of Nowhere|1965|false|1|false|known|false|
|13|Tu che ne sai|1965|false|1|false|known|false|
|14|You’re Hurtin’ Kinda Love|1965|false|1|false|known|false|
|15|Mademoiselle Dusty|1965|false|1|false|known|false|
|16|All I See Is You / Go Ahead On|1966|false|1|false|known|false|
|17|Little by Little / If It Hadn’t Been for You|1966|false|1|false|known|false|
|18|Goin’ Back|1966|false|1|false|known|false|
|19|What’s It Gonna Be / Small Town Girl|1967|false|1|false|known|false|
|20|I’ll Try Anything|1967|false|1|false|known|false|
|21|Give Me Time|1967|false|1|false|known|false|
|22|I Close My Eyes and Count to Ten / No Stranger Am I|1968|false|1|false|known|false|
|23|Sweet Ride|1968|false|1|false|known|false|
|24|I Will Come to You / The Colour of Your Eyes|1968|false|1|false|known|false|
|25|Am I The Same Girl (Soulful Strut)|1969|false|1|false|known|false|
|26|Willie & Laura Mae Jones / That Old Sweet Roll (Hi-De-Ho)|1969|false|1|false|known|false|
|27|I Wanna Be a Free Girl / Let Me in Your Way|1970|false|1|false|known|false|
|28|Spooky / How Can I Be Sure|1970|false|1|false|known|false|
|29|How Can I Be Sure|1970|false|1|false|known|false|
|30|I Believe In You|1971|false|1|false|known|false|
|31|Haunted|1971|false|1|false|known|false|
|32|O Holy Child|1964|false|0|false|known|false|
|33|What Good Is I Love You|1971|false|0|false|known|false|

### The Who — Margaret

Choice: My Generation. Decision: Qloo notable-song match. Popularity coverage incomplete: false.

|Rank|Candidate|Year|Qloo notable|Official releases|Widely released|Count status|Selected|
|---:|---|---:|---|---:|---|---|---|
|1|My Generation|1965|true|11|true|known|true|
|2|Substitute|1966|true|4|false|known|false|
|3|Happy Jack|1966|true|2|false|known|false|
|4|I Can See for Miles|1967|true|2|false|known|false|
|5|Pinball Wizard|1969|true|2|false|known|false|
|6|I Can See for Miles / Mary‐Anne With the Shaky Hands|1967|true|1|false|known|false|
|7|Won’t Get Fooled Again|1971|true|1|false|known|false|
|8|Baba O’Riley / My Wife|1971|true|1|false|known|false|
|9|I Can’t Explain|1965|false|12|true|known|false|
|10|Anyway, Anyhow, Anywhere|1965|false|3|false|known|false|
|11|A Legal Matter|1966|false|3|false|known|false|
|12|I’m a Boy|1966|false|2|false|known|false|
|13|Out in the Street|1966|false|2|false|known|false|
|14|The Last Time / Under My Thumb|1967|false|2|false|known|false|
|15|Pictures of Lily|1967|false|2|false|known|false|
|16|Call Me Lightning / Dr. Jekyll & Mr. Hyde|1968|false|2|false|known|false|
|17|Dogs|1968|false|2|false|known|false|
|18|Armenia City in the Sky / Mary Anne With the Shaky Hand|1968|false|2|false|known|false|
|19|Magic Bus / Dr. Jekyll and Mr. Hyde|1968|false|2|false|known|false|
|20|The Seeker|1970|false|2|false|known|false|
|21|La‐La‐La‐Lies|1966|false|1|false|known|false|
|22|Bucket “T”|1966|false|1|false|known|false|
|23|I’m Free|1969|false|1|false|known|false|
|24|I’m Free / We’re Not Gonna Take It|1969|false|1|false|known|false|
|25|Summertime Blues / Heaven and Hell|1970|false|1|false|known|false|
|26|See Me, Feel Me|1970|false|1|false|known|false|
|27|Let’s See Action|1971|false|1|false|known|false|

## Final rerun plans

### Dorothy — 1954–1969

Practical details: Sit on her right. Keep the volume low.

|Minutes|Activity|Invitation|
|---|---|---|
|0–3|Settle in and offer a choice|Choose some music, a conversation, or quiet company today.|
|3–7|Aretha Franklin|With Aretha Franklin, hum a little the way you might in a choir, or let the singer carry the tune.|
|7–8|A pause after Aretha Franklin|Take a quiet moment; continue only when it feels welcome.|
|8–12|I Love Lucy|Watch the people in “I Love Lucy”, or simply rest.|
|12–13|A pause after I Love Lucy|Leave some space between choices, with no need to fill the silence.|
|13–17|Elvis Presley|Listen for the instruments in “Blue Suede Shoes”, or enjoy a quiet pause.|
|17–18|A pause after Elvis Presley|Offer a little breathing room, or end here if that feels better.|
|18–22|Roy Orbison|Stay with a short part of “Ooby Dooby”, or choose quiet company.|
|22–23|A pause after Roy Orbison|Let the pace settle before deciding whether to continue.|
|23–25|An invitation: tea|Tell me how you like your tea, or we can sit quietly.|
|25–27|Follow the thread|Choose between “Roy Orbison” / “Elvis Presley” for another short moment, or enjoy quiet company.|
|27–30|Close gently|Thank you for this time together; we can rest now, or choose something familiar.|

|Item|Work / date|Swap list|
|---|---|---|
|Aretha Franklin|(You Make Me Feel Like) A Natural Woman · 1967|Ray Charles; Etta James; Chuck Berry|
|I Love Lucy|I Love Lucy · 1951–1957|The Dick Van Dyke Show; The Honeymooners; The George Burns and Gracie Allen Show|
|Elvis Presley|Blue Suede Shoes · 1956|Jerry Lee Lewis; Chuck Berry; Ray Charles|
|Roy Orbison|Ooby Dooby · 1956|Jerry Lee Lewis; Chuck Berry; Ray Charles|

Item labels and swap evidence:

- **Aretha Franklin:** A caregiver-supplied favourite, resolved by Qloo. (You Make Me Feel Like) A Natural Woman (1967), dated by MusicBrainz. Chosen because confirmed notes mention choir singing.
  Swap audit: Ray Charles (shared primary genre: soul, rhythm and blues, gospel; shared genre: soul, rhythm and blues, gospel, jazz, blues, pop, r and b; same Qloo seed neighbourhood; matching region: United States). Etta James (shared primary genre: soul, rhythm and blues; shared genre: soul, rhythm and blues, gospel, jazz, blues, r and b; same Qloo seed neighbourhood; matching region: United States). Chuck Berry (shared primary genre: rhythm and blues; shared genre: rhythm and blues, blues; matching region: United States). Jerry Lee Lewis (shared genre: rhythm and blues, gospel, blues; matching region: United States). Bobby Darin (shared genre: jazz, pop; matching region: United States). At least two unused, related, era-fit, avoid-clear alternatives.
- **I Love Lucy:** A caregiver-supplied favourite, resolved by Qloo. I Love Lucy (1951–1957), dated by TMDB.
  Swap audit: The Dick Van Dyke Show (shared genre: domestic comedy, comedy, sitcom, family; same Qloo seed neighbourhood; matching region: United States). The Honeymooners (shared genre: domestic comedy, comedy, classic television, sitcom, family; same Qloo seed neighbourhood; matching region: United States). The George Burns and Gracie Allen Show (shared genre: domestic comedy, comedy; same Qloo seed neighbourhood; matching region: United States). At least two unused, related, era-fit, avoid-clear alternatives.
- **Elvis Presley:** A caregiver-supplied favourite, resolved by Qloo. Blue Suede Shoes (1956), dated by MusicBrainz.
  Swap audit: Jerry Lee Lewis (shared primary genre: rock and roll, rockabilly, country; shared genre: rock and roll, rockabilly, country, gospel, rhythm and blues, blues, classic rock, rock; same Qloo seed neighbourhood; matching region: United States). Chuck Berry (shared primary genre: rock and roll, rhythm and blues; shared genre: rock and roll, rockabilly, country, rhythm and blues, blues, classic rock, rock; same Qloo seed neighbourhood; matching region: United States). Ray Charles (shared primary genre: pop, country, gospel, rhythm and blues; shared genre: rock and roll, pop, country, gospel, rhythm and blues, blues, soul; matching region: United States). Etta James (shared primary genre: rhythm and blues; shared genre: rock and roll, gospel, rhythm and blues, blues, soul; matching region: United States). Bobby Darin (shared primary genre: rock and roll, pop; shared genre: rock and roll, pop, country; matching region: United States). At least two unused, related, era-fit, avoid-clear alternatives.
- **Roy Orbison:** Because you chose Elvis Presley, Qloo suggested this music. Personal familiarity is unconfirmed. Ooby Dooby (1956), dated by MusicBrainz.
  Swap audit: Jerry Lee Lewis (shared primary genre: rockabilly, rock and roll, country; shared genre: rockabilly, rock, rock and roll, country, classic rock; same Qloo seed neighbourhood; matching region: United States). Chuck Berry (shared primary genre: rock and roll; shared genre: rockabilly, rock, rock and roll, country, classic rock, pop rock; same Qloo seed neighbourhood; matching region: United States). Ray Charles (shared primary genre: pop, country; shared genre: rock and roll, pop, country; matching region: United States). Bobby Darin (shared primary genre: rock and roll, pop; shared genre: rock and roll, pop, country; matching region: United States). Etta James (shared genre: rock and roll; matching region: United States). At least two unused, related, era-fit, avoid-clear alternatives.

Coverage and exclusions:

- The Lords and the New Creatures was left out: conservative default matched death, funeral or hospital themes.
- Preview all media, check volume and suitability, and follow the person’s lead. Stop the stimulus if distress appears and follow the established comfort approach.

- Pending: Frank Sinatra — MusicBrainz cache miss while offline.

### Margaret — 1956–1971

Practical details: Sit facing her so she can see your face.

|Minutes|Activity|Invitation|
|---|---|---|
|0–3|Settle in and offer a choice|Choose some music, a conversation, or quiet company today.|
|3–7|The Beatles|With The Beatles, try a small dance movement while seated, or let your feet rest.|
|7–8|A pause after The Beatles|Take a quiet moment; continue only when it feels welcome.|
|8–12|Dusty Springfield|Try humming a little of “You Don’t Have to Say You Love Me”, or rest your voice.|
|12–13|A pause after Dusty Springfield|Leave some space between choices, with no need to fill the silence.|
|13–17|Coronation Street|We can watch a short part of “Coronation Street”, or turn the screen off.|
|17–18|A pause after Coronation Street|Offer a little breathing room, or end here if that feels better.|
|18–22|The Who|Stay with a short part of “My Generation”, or choose quiet company.|
|22–23|A pause after The Who|Let the pace settle before deciding whether to continue.|
|23–25|An invitation: Sunday lunch|Name a favourite part of Sunday lunch, or let’s leave the table as it is.|
|25–27|Follow the thread|Choose between “The Who” / “The Beatles” for another short moment, or enjoy quiet company.|
|27–30|Close gently|Thank you for this time together; we can rest now, or choose something familiar.|

|Item|Work / date|Swap list|
|---|---|---|
|The Beatles|Help! · 1965|The Rolling Stones; Led Zeppelin; Paul McCartney|
|Dusty Springfield|You Don’t Have to Say You Love Me · 1966|Petula Clark; Paul McCartney; The Hollies|
|Coronation Street|Coronation Street · 1960–present|None: fewer than two unused qualifying options|
|The Who|My Generation · 1965|The Rolling Stones; Led Zeppelin; Paul McCartney|

Item labels and swap evidence:

- **The Beatles:** A caregiver-supplied favourite, resolved by Qloo. Help! (1965), dated by MusicBrainz. Chosen because confirmed notes mention dancing.
  Swap audit: The Rolling Stones (shared primary genre: rock, classic rock; shared genre: rock, pop rock, classic rock, psychedelic rock, hard rock, british; same Qloo seed neighbourhood; matching region: United Kingdom). Led Zeppelin (shared primary genre: rock, classic rock; shared genre: rock, classic rock, psychedelic rock, folk rock, hard rock; same Qloo seed neighbourhood; matching region: United Kingdom). Paul McCartney (shared primary genre: rock, classic rock; shared genre: rock, pop rock, classic rock, psychedelic rock, pop, baroque pop, folk rock, experimental, british; same Qloo seed neighbourhood; matching region: United Kingdom). The Hollies (shared primary genre: rock, pop rock; shared genre: rock, pop rock, classic rock, psychedelic rock, folk rock, british, beat; matching region: United Kingdom). Petula Clark (shared genre: pop, british; matching region: United Kingdom). At least two unused, related, era-fit, avoid-clear alternatives.
- **Dusty Springfield:** A caregiver-supplied favourite, resolved by Qloo. You Don’t Have to Say You Love Me (1966), dated by MusicBrainz.
  Swap audit: Petula Clark (shared primary genre: pop; shared genre: pop, adult contemporary, easy listening; same Qloo seed neighbourhood; matching region: United Kingdom). Paul McCartney (shared primary genre: pop; shared genre: pop, orchestral pop, rock; matching region: United Kingdom). The Hollies (shared genre: rock; same Qloo seed neighbourhood; matching region: United Kingdom). The Rolling Stones (shared genre: rock, rhythm and blues; matching region: United Kingdom). Led Zeppelin (shared genre: rock; matching region: United Kingdom). At least two unused, related, era-fit, avoid-clear alternatives.
- **Coronation Street:** A caregiver-supplied favourite, resolved by Qloo. Coronation Street (1960–present), dated by TMDB.
  Swap audit: On the Buses (same Qloo seed neighbourhood; matching region: United Kingdom). Fewer than two unused qualifying alternatives.
- **The Who:** Because you chose The Beatles, Qloo suggested this music. Personal familiarity is unconfirmed. My Generation (1965), dated by MusicBrainz.
  Swap audit: The Rolling Stones (shared primary genre: rock, classic rock; shared genre: rock, classic rock, hard rock, blues rock, british, psychedelic rock; same Qloo seed neighbourhood; matching region: United Kingdom). Led Zeppelin (shared primary genre: rock, classic rock, hard rock; shared genre: rock, classic rock, hard rock, progressive rock, blues rock, psychedelic rock; same Qloo seed neighbourhood; matching region: United Kingdom). Paul McCartney (shared primary genre: rock, classic rock; shared genre: rock, classic rock, power pop, british, psychedelic rock; same Qloo seed neighbourhood; matching region: United Kingdom). The Hollies (shared primary genre: rock; shared genre: rock, classic rock, british, psychedelic rock; matching region: United Kingdom). Petula Clark (shared genre: british; matching region: United Kingdom). At least two unused, related, era-fit, avoid-clear alternatives.

Coverage and exclusions:

- Upstairs, Downstairs was left out: provider metadata matched war.
- Steptoe and Son was left out: provider metadata matched war.
- The Prisoner was left out: provider metadata matched war.
- Preview all media, check volume and suitability, and follow the person’s lead. Stop the stimulus if distress appears and follow the established comfort approach.

- Pending: Woman in a Dressing Gown — No cached film/TV date is available while offline..
- Pending: Sandie Shaw — MusicBrainz cache miss while offline.

### Robert — 1960–1975

Practical details: Sit on his left.

|Minutes|Activity|Invitation|
|---|---|---|
|0–3|Settle in and offer a choice|Choose some music, a conversation, or quiet company today.|
|3–6|Stevie Wonder|Tap along to “Signed, Sealed, Delivered I’m Yours”, or simply listen.|
|6–7|A pause after Stevie Wonder|Take a quiet moment; continue only when it feels welcome.|
|7–10|The Mary Tyler Moore Show|Watch the people in “The Mary Tyler Moore Show”, or simply rest.|
|10–11|A pause after The Mary Tyler Moore Show|Leave some space between choices, with no need to fill the silence.|
|11–14|Carole King|Keep the beat with one hand during “It's Too Late”, or let your hands rest.|
|14–15|A pause after Carole King|Offer a little breathing room, or end here if that feels better.|
|15–18|The Isley Brothers|Listen for the instruments in “Twist and Shout”, or enjoy a quiet pause.|
|18–19|A pause after The Isley Brothers|Let the pace settle before deciding whether to continue.|
|19–23|The Dick Van Dyke Show|Look at the setting in “The Dick Van Dyke Show”, or skip this clip.|
|23–24|A pause after The Dick Van Dyke Show|Make room for rest, letting the person choose when to move on.|
|24–25|An invitation: radio dramas|Tell me whether you prefer a short radio story or music, or choose quiet.|
|25–26|An invitation: pancakes|Tell me how you like to make pancakes, or we can choose another topic.|
|26–27|Follow the thread|Choose between “The Dick Van Dyke Show” / “The Mary Tyler Moore Show” for another short moment, or enjoy quiet company.|
|27–30|Close gently|Thank you for this time together; we can rest now, or choose something familiar.|

|Item|Work / date|Swap list|
|---|---|---|
|Stevie Wonder|Signed, Sealed, Delivered I’m Yours · 1970|Sly & The Family Stone; Harry Nilsson; Linda Ronstadt|
|The Mary Tyler Moore Show|The Mary Tyler Moore Show · 1970–1977|None: fewer than two unused qualifying options|
|Carole King|It's Too Late · 1971|Janis Ian; Harry Nilsson; Linda Ronstadt|
|The Dick Van Dyke Show|The Dick Van Dyke Show · 1961–1966|None: fewer than two unused qualifying options|
|The Isley Brothers|Twist and Shout · 1962|Sly & The Family Stone; Harry Nilsson; Linda Ronstadt|

Item labels and swap evidence:

- **Stevie Wonder:** A caregiver-supplied favourite, resolved by Qloo. Signed, Sealed, Delivered I’m Yours (1970), dated by MusicBrainz. Check before playing: Qloo’s lyrical themes mention “political”, and your avoid list includes politics.
  Swap audit: Sly & The Family Stone (shared primary genre: soul, funk; shared genre: soul, funk, psychedelic soul, r and b; same Qloo seed neighbourhood; matching region: United States). Harry Nilsson (shared primary genre: pop; shared genre: pop, soft rock, singersongwriter; matching region: United States). Linda Ronstadt (shared primary genre: pop; shared genre: pop, adult contemporary, soft rock, jazz; matching region: United States). Janis Ian (shared genre: pop, soft rock, singersongwriter; matching region: United States). At least two unused, related, era-fit, avoid-clear alternatives.
- **The Mary Tyler Moore Show:** A caregiver-supplied favourite, resolved by Qloo. The Mary Tyler Moore Show (1970–1977), dated by TMDB. Check before playing: Qloo’s keywords and tags mention “election”, and your avoid list includes politics.
  Swap audit: The Jeffersons (shared genre: comedy, sitcom; same Qloo seed neighbourhood; matching region: United States). Fewer than two unused qualifying alternatives.
- **Carole King:** A caregiver-supplied favourite, resolved by Qloo. It's Too Late (1971), dated by MusicBrainz.
  Swap audit: Janis Ian (shared primary genre: singersongwriter, folk; shared genre: pop, soft rock, singersongwriter, folk, classic rock, folk rock, singer and songwriter, singer songwriter; same Qloo seed neighbourhood; matching region: United States). Harry Nilsson (shared primary genre: pop, soft rock; shared genre: pop, soft rock, singersongwriter, classic rock, folk rock, singer and songwriter; matching region: United States). Linda Ronstadt (shared primary genre: pop, folk; shared genre: pop, soft rock, folk, adult contemporary, classic rock, folk rock; matching region: United States). Sly & The Family Stone (matching region: United States). At least two unused, related, era-fit, avoid-clear alternatives.
- **The Dick Van Dyke Show:** Because you chose The Mary Tyler Moore Show, Qloo suggested this TV show. Personal familiarity is unconfirmed. The Dick Van Dyke Show (1961–1966), dated by TMDB.
  Swap audit: The Jeffersons (shared genre: comedy, sitcom; same Qloo seed neighbourhood; matching region: United States). Fewer than two unused qualifying alternatives.
- **The Isley Brothers:** Because you chose Stevie Wonder, Qloo suggested this music. Personal familiarity is unconfirmed. Twist and Shout (1962), dated by MusicBrainz.
  Swap audit: Sly & The Family Stone (shared primary genre: soul, funk; shared genre: soul, funk, r and b, rock, funk rock, psychedelic soul; same Qloo seed neighbourhood; matching region: United States). Harry Nilsson (shared primary genre: rock; shared genre: rock; matching region: United States). Linda Ronstadt (shared primary genre: rock; shared genre: rock; matching region: United States). Janis Ian (matching region: United States). At least two unused, related, era-fit, avoid-clear alternatives.

Coverage and exclusions:

- Maude was left out: provider metadata matched politics.
- Preview all media, check volume and suitability, and follow the person’s lead. Stop the stimulus if distress appears and follow the established comfort approach.

- Pending: Dionne Warwick — MusicBrainz cache miss while offline.

## Margaret: actual constrained request results

Every row below comes from the final request trace. Music uses both ordinary seed neighbourhoods and supplementary British-tag searches; movie/TV requests include United Kingdom. Raw normalized metadata and all decision traces remain in the evidence JSON.

### The Beatles → urn:entity:artist

Constraints: {"era":{"from":1956,"to":1971},"country":"United Kingdom","regionalTags":[]}.

|Provider rank|Candidate|Outcome / reason|
|---:|---|---|
|1|The Who|Running order|
|2|John Lennon|Deduplicated John Lennon from The Beatles. Excluded John Lennon: war matched provider metadata.|
|3|The Rolling Stones|Verified alternative|
|4|The Doors|Held back The Doors: date-check budget reached.|
|5|Led Zeppelin|Verified alternative|

### The Beatles → urn:entity:movie

Constraints: {"era":{"from":1956,"to":1971},"country":"United Kingdom","regionalTags":[]}.

|Provider rank|Candidate|Outcome / reason|
|---:|---|---|
|1|A Hard Day's Night|Verified alternative|
|2|Help!|Deduplicated Help! from Dusty Springfield. Help!: No unique title in TMDB; ambiguous remakes are not guessed.|
|3|Yellow Submarine|Deduplicated Yellow Submarine from Dusty Springfield. Held back Yellow Submarine: date-check budget reached.|
|4|Let It Be|Held back Let It Be: date-check budget reached.|
|5|Magical Mystery Tour|Held back Magical Mystery Tour: date-check budget reached.|

### The Beatles → urn:entity:tv_show

Constraints: {"era":{"from":1956,"to":1971},"country":"United Kingdom","regionalTags":[]}.

|Provider rank|Candidate|Outcome / reason|
|---:|---|---|
|1|Upstairs, Downstairs|Deduplicated Upstairs, Downstairs from Dusty Springfield. Deduplicated Upstairs, Downstairs from Coronation Street. Excluded Upstairs, Downstairs: war matched provider metadata.|
|2|The Forsyte Saga|Deduplicated The Forsyte Saga from Dusty Springfield. The Forsyte Saga: No unique title in TMDB; ambiguous remakes are not guessed.|
|3|The Prisoner|Excluded The Prisoner: war matched provider metadata.|
|4|Play for Today|Held back Play for Today: date-check budget reached.|
|5|Elizabeth R|Deduplicated Elizabeth R from Dusty Springfield. Held back Elizabeth R: date-check budget reached.|

### The Beatles → urn:entity:book

Constraints: {"era":{"from":1956,"to":1971},"country":"United Kingdom","regionalTags":[]}.

|Provider rank|Candidate|Outcome / reason|
|---:|---|---|
|1|The Doors of Perception & Heaven and Hell|Held back The Doors of Perception & Heaven and Hell: date-check budget reached.|
|2|A Moveable Feast|Held back A Moveable Feast: date-check budget reached.|
|3|Island|Held back Island: date-check budget reached.|
|4|One Flew Over the Cuckoo's Nest|Deduplicated One Flew Over the Cuckoo's Nest from Dusty Springfield. Held back One Flew Over the Cuckoo's Nest: date-check budget reached.|
|5|The Electric Kool-Aid Acid Test|Held back The Electric Kool-Aid Acid Test: date-check budget reached.|

### The Beatles → urn:entity:artist (regional tag)

Constraints: {"era":{"from":1956,"to":1971},"country":"United Kingdom","regionalTags":["urn:tag:genre:music:british"]}.

|Provider rank|Candidate|Outcome / reason|
|---:|---|---|
|1|The Who|Running order|
|2|John Lennon|Deduplicated John Lennon from The Beatles. Excluded John Lennon: war matched provider metadata.|
|3|The Rolling Stones|Verified alternative|
|4|Paul McCartney|Verified alternative|
|5|George Harrison|Held back George Harrison: date-check budget reached.|

### Dusty Springfield → urn:entity:artist

Constraints: {"era":{"from":1956,"to":1971},"country":"United Kingdom","regionalTags":[]}.

|Provider rank|Candidate|Outcome / reason|
|---:|---|---|
|1|The Supremes|Held back The Supremes: date-check budget reached.|
|2|Smokey Robinson and The Miracles|Held back Smokey Robinson and The Miracles: date-check budget reached.|
|3|Martha Reeves & The Vandellas|Held back Martha Reeves & The Vandellas: date-check budget reached.|
|4|The Mamas & the Papas|Held back The Mamas & the Papas: date-check budget reached.|
|5|The Four Tops|Held back The Four Tops: date-check budget reached.|

### Dusty Springfield → urn:entity:movie

Constraints: {"era":{"from":1956,"to":1971},"country":"United Kingdom","regionalTags":[]}.

|Provider rank|Candidate|Outcome / reason|
|---:|---|---|
|1|A Hard Day's Night|Verified alternative|
|2|Lolita|Excluded Lolita: hospital scenes matched provider metadata.|
|3|Woodstock|Excluded Woodstock: war matched provider metadata.|
|4|Yellow Submarine|Deduplicated Yellow Submarine from Dusty Springfield. Held back Yellow Submarine: date-check budget reached.|
|5|Help!|Deduplicated Help! from Dusty Springfield. Help!: No unique title in TMDB; ambiguous remakes are not guessed.|

### Dusty Springfield → urn:entity:tv_show

Constraints: {"era":{"from":1956,"to":1971},"country":"United Kingdom","regionalTags":[]}.

|Provider rank|Candidate|Outcome / reason|
|---:|---|---|
|1|Upstairs, Downstairs|Deduplicated Upstairs, Downstairs from Dusty Springfield. Deduplicated Upstairs, Downstairs from Coronation Street. Excluded Upstairs, Downstairs: war matched provider metadata.|
|2|The Forsyte Saga|Deduplicated The Forsyte Saga from Dusty Springfield. The Forsyte Saga: No unique title in TMDB; ambiguous remakes are not guessed.|
|3|Coronation Street|Running order|
|4|The Six Wives of Henry VIII|The Six Wives of Henry VIII: No unique title in TMDB; ambiguous remakes are not guessed.|
|5|Elizabeth R|Deduplicated Elizabeth R from Dusty Springfield. Held back Elizabeth R: date-check budget reached.|

### Dusty Springfield → urn:entity:book

Constraints: {"era":{"from":1956,"to":1971},"country":"United Kingdom","regionalTags":[]}.

|Provider rank|Candidate|Outcome / reason|
|---:|---|---|
|1|One Flew Over the Cuckoo's Nest|Deduplicated One Flew Over the Cuckoo's Nest from Dusty Springfield. Held back One Flew Over the Cuckoo's Nest: date-check budget reached.|
|2|Slaughterhouse-Five|Excluded Slaughterhouse-Five: war matched provider metadata.|
|3|The Bell Jar|Verified alternative|
|4|Flowers for Algernon|Excluded Flowers for Algernon: hospital scenes matched provider metadata.|
|5|Catch-22|Excluded Catch-22: war matched provider metadata.|

### Dusty Springfield → urn:entity:artist (regional tag)

Constraints: {"era":{"from":1956,"to":1971},"country":"United Kingdom","regionalTags":["urn:tag:genre:music:british"]}.

|Provider rank|Candidate|Outcome / reason|
|---:|---|---|
|1|The Hollies|Verified alternative|
|2|Petula Clark|Verified alternative|
|3|Love Affair|Love Affair: More than one MusicBrainz artist matches; choose the intended artist.|
|4|Sandie Shaw|Sandie Shaw: MusicBrainz cache miss while offline|
|5|The Animals|Held back The Animals: date-check budget reached.|

### Coronation Street → urn:entity:artist

Constraints: {"era":{"from":1956,"to":1971},"country":"United Kingdom","regionalTags":[]}.

|Provider rank|Candidate|Outcome / reason|
|---:|---|---|
|1|Pixie Lott|Deduplicated Pixie Lott from Coronation Street. Held back Pixie Lott: date-check budget reached.|
|2|Paloma Faith|Deduplicated Paloma Faith from Coronation Street. Held back Paloma Faith: date-check budget reached.|
|3|Eliza Doolittle|Deduplicated Eliza Doolittle from Coronation Street. Held back Eliza Doolittle: date-check budget reached.|
|4|Will Young|Deduplicated Will Young from Coronation Street. Held back Will Young: date-check budget reached.|
|5|The Saturdays|Deduplicated The Saturdays from Coronation Street. Held back The Saturdays: date-check budget reached.|

### Coronation Street → urn:entity:movie

Constraints: {"era":{"from":1956,"to":1971},"country":"United Kingdom","regionalTags":[]}.

|Provider rank|Candidate|Outcome / reason|
|---:|---|---|
|1|The Railway Children|The Railway Children: No unique title in TMDB; ambiguous remakes are not guessed.|
|2|Woman in a Dressing Gown|Woman in a Dressing Gown: No cached film/TV date is available while offline.|
|3|Summer Holiday|Held back Summer Holiday: date-check budget reached.|
|4|Spring and Port Wine|Held back Spring and Port Wine: date-check budget reached.|
|5|The Prime of Miss Jean Brodie|Excluded The Prime of Miss Jean Brodie: war matched provider metadata.|

### Coronation Street → urn:entity:tv_show

Constraints: {"era":{"from":1956,"to":1971},"country":"United Kingdom","regionalTags":[]}.

|Provider rank|Candidate|Outcome / reason|
|---:|---|---|
|1|Upstairs, Downstairs|Deduplicated Upstairs, Downstairs from Dusty Springfield. Deduplicated Upstairs, Downstairs from Coronation Street. Excluded Upstairs, Downstairs: war matched provider metadata.|
|2|Steptoe and Son|Excluded Steptoe and Son: war matched provider metadata.|
|3|On the Buses|Verified alternative|
|4|Dad's Army|Held back Dad's Army: date-check budget reached.|
|5|The Goodies|Held back The Goodies: date-check budget reached.|

### Coronation Street → urn:entity:book

Constraints: {"era":{"from":1956,"to":1971},"country":"United Kingdom","regionalTags":[]}.

|Provider rank|Candidate|Outcome / reason|
|---:|---|---|
|1|Cider with Rosie|Excluded Cider with Rosie: war matched provider metadata.|
|2|I'm the King of the Castle|Verified alternative|
|3|Covenant With Death|Held back Covenant With Death: date-check budget reached.|
|4|The Reefs of Earth|Held back The Reefs of Earth: date-check budget reached.|
|5|Strange Meeting|Held back Strange Meeting: date-check budget reached.|

### Coronation Street → urn:entity:artist (regional tag)

Constraints: {"era":{"from":1956,"to":1971},"country":"United Kingdom","regionalTags":["urn:tag:genre:music:british"]}.

|Provider rank|Candidate|Outcome / reason|
|---:|---|---|
|1|Pixie Lott|Deduplicated Pixie Lott from Coronation Street. Held back Pixie Lott: date-check budget reached.|
|2|Paloma Faith|Deduplicated Paloma Faith from Coronation Street. Held back Paloma Faith: date-check budget reached.|
|3|Eliza Doolittle|Deduplicated Eliza Doolittle from Coronation Street. Held back Eliza Doolittle: date-check budget reached.|
|4|Will Young|Deduplicated Will Young from Coronation Street. Held back Will Young: date-check budget reached.|
|5|The Saturdays|Deduplicated The Saturdays from Coronation Street. Held back The Saturdays: date-check budget reached.|

## Notes accuracy

Dorothy’s existing demo notes mention choir singing and afternoon tea, not baking pies, a school-cook career or sewing. Those details were not invented and the demo notes were not edited. The tea invitation supports those details when they are actually present in confirmed notes; her current plan retains choir, tea and short quiet pauses.

## Browser verification

Production build, headless Chromium, real rerun kits in a temporary protected workspace. An additional explicitly synthetic display fixture checks the artist-level badge.

- Dorothy: reload passed; Begin Session passed; replacement persisted: Ray Charles. Follow the thread: Choose between “Roy Orbison” / “Elvis Presley” for another short moment, or enjoy quiet company.
- Margaret: reload passed; Begin Session passed; replacement persisted: The Rolling Stones. Follow the thread: Choose between “The Who” / “The Beatles” for another short moment, or enjoy quiet company.
- Robert: reload passed; Begin Session passed; replacement persisted: Harry Nilsson. Follow the thread: Choose between “The Dick Van Dyke Show” / “The Mary Tyler Moore Show” for another short moment, or enjoy quiet company.
- Artist-level display fixture: passed (explicit synthetic display fixture).
- Browser page errors: 0.

Screenshots and rendered swap/badge results: /tmp/echoes-consolidated-ui/results.json.

## Automated validation

- npm test: 119 passed; 0 failed.
- Production build: npx next build --webpack; log at /tmp/echoes-consolidated-build.log.
- Demo profile file unchanged; no birth-year or note edits.

## Repeat the checks

```sh
npm test
npx next build --webpack
node scripts/diagnose-three-profiles.cjs /tmp/echoes-three-consolidated-final.json
# Set PLAYWRIGHT_MODULE and CHROMIUM_PATH if Playwright is installed outside this repository.
node scripts/verify-consolidated-ui.cjs /tmp/echoes-three-consolidated-final.json
node scripts/report-consolidated.cjs /tmp/echoes-three-consolidated-final.json
```

For manual testing, create a new kit from each unchanged demo profile. Existing saved kits retain their saved content. Review Overview and Tips, expand Adjust this activity to inspect available swaps, reload, then start the session.
