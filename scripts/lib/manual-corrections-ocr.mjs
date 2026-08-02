// 少數官方 PDF 頁面沒有文字層。以下內容已逐頁對照官方原卷人工校正。
export const QUESTION_CORRECTIONS_OCR = {
  106: {
    13: {
      stem: "Clerk: How can I help you?\nCustomer: Yes, this desk lamp was broken when I tried to turn it on at home.\nClerk: ____________\nCustomer: Great, thanks for your assistance.",
      options: { A: "Believe it or not, it’s just been bought.", B: "I’m sorry, but I can replace it for you.", C: "It seems you’re interested in the house.", D: "The mechanic will fix your car in no time." },
    },
    14: {
      stem: "Fred: Oops! I left my workbook at home!\nJamie: ____________ Ms. Kim reminded us just yesterday about it.\nFred: There isn’t much I can do. It’s too late for me to go back home now.\nJamie: Ms. Kim will be very upset.",
      options: { A: "Salaries have not gone up.", B: "You are in trouble, my friend.", C: "He left the bookstore yesterday.", D: "Consider the assignment done." },
    },
    15: {
      stem: "Zax: What are today’s headlines?\nClaire: Super Junior canceled tomorrow’s concert.\nZax: ____________\nClaire: You bet. So many fans like me were very excited about seeing their show.",
      options: { A: "It sounds like you’re not into music.", B: "How many fans will be attending it?", C: "Who are the members of the band?", D: "You must feel terribly disappointed." },
    },
    16: {
      stem: "Dora: Where can I get that novel?\nDavid: I just ordered it online.\nDora: ____________\nDavid: Anyone can! It’s so easy to use online bookstores nowadays.",
      options: { A: "I’m amazed you can do that.", B: "How’s the store’s service quality?", C: "It’s actually about storytelling.", D: "The system has a virus, doesn’t it?" },
    },
    17: {
      stem: "Jill: When is your monthly test?\nLarry: Next Thursday. Oh, I’m running out of time!\nJill: Relax! There are still five more days to prepare.\nLarry: Easy for you to say. ____________\nJill: I have confidence in you.",
      options: { A: "I can’t believe he spoke to you this way.", B: "I’m not sure if I can be ready by that time.", C: "But it’s kind of dangerous to run here.", D: "The monthly treatment takes too long." },
    },
    18: {
      stem: "Operator: City Hall. How may I direct your call?\nCitizen: ____________\nOperator: And the reason for your call?\nCitizen: Well, the park in our neighborhood looks terrible. I mean, there’s litter everywhere and nobody has picked it up.\nOperator: I see. One moment please.",
      options: { A: "I’d like to speak to Environmental Services, please.", B: "Yes, you may hand the problem to our department.", C: "Read it before you hand it in to the director, please.", D: "Please turn right at the next corner to find the center." },
    },
  },
  107: {
    32: {
      stem: "On which day is it most likely to rain?",
      options: { A: "Monday", B: "Tuesday", C: "Thursday", D: "Friday" },
    },
    33: {
      stem: "Jane is planning a two-day trip to Hualien. She likes sunny days, so which period would be the best choice for the trip?",
      options: { A: "Monday to Tuesday", B: "Tuesday to Wednesday", C: "Wednesday to Thursday", D: "Thursday to Friday" },
    },
    34: {
      stem: "According to the passage, which of the following best describes Chi at the time he recorded Typhoon Morakot?",
      options: { A: "Chi had been a famous movie director for twenty years.", B: "Chi had been an award-winning typhoon photographer.", C: "Chi was an employee hired by the government at that time.", D: "Chi was sent to record the pace and movement of the typhoon." },
    },
    35: {
      stem: "Which of the following has the closest meaning to the word “raising” in paragraph 3?",
      options: { A: "collecting", B: "lifting", C: "moving", D: "promoting" },
    },
  },
};

export const GROUP_CORRECTIONS_OCR = {
  107: {
    G32_33: `<p>The following is the weather forecast for the next five days in Hualien. Answer the questions based on the given information.</p>`,
    G34_37: `<p>At the 50th Golden Horse Film Festival, <em>Beyond Beauty: Taiwan from Above</em>《看見台灣》won the 2013 Best Documentary Award. Before directing the documentary, Chi Po-lin (齊柏林) was a full-time photographer working for the Ministry of Transportation and Communications. He had been taking pictures from an aircraft for twenty years.</p><p>In 2009, in a mission to record the damage caused by Typhoon Morakot, Chi found that the landslides brought about by this typhoon buried several mountain villages, and many areas were covered in flood waters. When Chi learned about the serious harm of land abuse, he decided to quit his government job to make films.</p><p>During the filming of <em>Beyond Beauty: Taiwan from Above</em>, Chi had difficulties raising funds. To meet the total costs of some NT$90 million, he used up all his savings and even asked for a bank loan. After the successful release of the documentary in around thirty countries, Chi planned to make a sequel. On June 10, 2017, unfortunately, when Chi was shooting the sequel, his helicopter crashed in the mountains. Many were saddened by the news of his death, but Chi will always be remembered for his contribution to promoting environmental awareness.</p>`,
  },
};

export const TEXT_REPLACEMENTS = {
  90: [["wo n", "won"], ["e- mails", "e-mails"], ["typ e", "type"], ["sho ws", "shows"]],
};
