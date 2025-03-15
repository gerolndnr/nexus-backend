import neo4j, { Driver } from "neo4j-driver";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
const openai = new OpenAI();

let databaseDriver: Driver;

const Person = z.object({
  name: z.string(),
  skills: z.array(z.string()),
});

const UsefulSkills = z.object({
  skills: z.array(z.string()),
});

async function main() {
  await connectDatabase();

  const personName = "Lius Hohmann";
  const text = "Lius Hohmann can program in JavaScript and C#.";

  const allSkills = await getAllSkills();
  // const extractedSkills = await extractSkills(text, personName, allSkills);
  const extractedSkills = ["Java", "JavaScript", "Rust"];

  if (extractedSkills) {
    for (let skill of extractedSkills) {
      // await addSkillToPerson(personName, skill);
    }
  }

  const usefulSkills = await findNecessarySkills(
    "I need a Java expert.",
    allSkills,
  );

  if (usefulSkills) {
    console.log(usefulSkills);
  }
}

main();

async function connectDatabase() {
  console.debug("Connecting to database...");

  const databaseUri = process.env.NEO4J_URI;
  const databaseUsername = process.env.NEO4J_USERNAME;
  const databasePassword = process.env.NEO4J_PASSWORD;

  if (databaseUri == undefined || databaseUri === "") {
    console.error("Please set the environment variable 'NEO4J_URI'");
    process.exit(1);
  }
  if (databaseUsername == undefined || databaseUsername === "") {
    console.error("Please set the environment variable 'NEO4J_USERNAME'");
    process.exit(1);
  }
  if (databasePassword == undefined || databasePassword === "") {
    console.error("Please set the environment variable 'NEO4J_PASSWORD'");
    process.exit(1);
  }

  try {
    databaseDriver = neo4j.driver(
      databaseUri,
      neo4j.auth.basic(databaseUsername, databasePassword),
    );

    const serverInfo = await databaseDriver.getServerInfo();
  } catch (err) {
    console.error("Can't connect to database.");
    process.exit(1);
  }
}

/**
 * Returns a list of all skills in the database.
 * @returns {string[]} List of all skills.
 */
async function getAllSkills() {
  console.debug("Getting all skills...");

  const result = await databaseDriver.executeQuery(
    "MATCH (skill: Skill) RETURN skill",
  );

  let skillList = [];

  for (let record of result.records) {
    skillList.push(record.get("skill").properties.skillName);
  }

  return skillList;
}

export var getAllPersons = function (): string[] {
  console.debug("Getting all persons...");
  return [];
};

async function addSkillToPerson(person: string, skill: string) {
  console.debug("Adding skill to person...");
  console.log(`Adding skill ${skill}`);

  const result = await databaseDriver.executeQuery(
    "MERGE (person:Person { personName: $personName }) MERGE (skill:Skill { skillName: $skillName }) MERGE (person)-[:HAS_SKILL]->(skill) RETURN person.name",
    { personName: person, skillName: skill },
  );
}

/**
 * @param text Text from which the skills are extracted.
 * @param person Target person
 * @param existingSkills
 * @returns List of all skills
 */
async function extractSkills(
  text: string,
  person: string,
  existingSkills: string[],
): Promise<string[] | undefined> {
  console.debug("Extracting skills...");

  const existingSkillJoined = existingSkills.join(", ");

  let systemContent = `Extract the skills (preferably in one word) of the person called ${person}.`;

  if (existingSkills.length !== 0) {
    systemContent = `Extract the skills (preferably in one word) of the person called ${person}. The following skills already exist and can be used, but if the person has skills not in this list, create a new one: ${existingSkillJoined}`;
  }

  const completion = await openai.beta.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: systemContent,
      },
      {
        role: "user",
        content: text,
      },
    ],
    response_format: zodResponseFormat(Person, "person"),
  });

  return completion.choices[0].message.parsed?.skills;
}

/**
 * Finds skills, which could be helpful to solve the described problem.
 * @param text Text describing a problem.
 * @param existingSkills List of available skills.
 * @returns {string[]} List of necessary skills.
 */
async function findNecessarySkills(text: string, existingSkills: string[]) {
  console.debug("Finding necessary skills...");

  const completion = await openai.beta.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Find the skills out of the following list that could help the most with the problem the user describes. ${existingSkills.join(", ")}`,
      },
      {
        role: "user",
        content: text,
      },
    ],
    response_format: zodResponseFormat(UsefulSkills, "useful-skills"),
  });

  return completion.choices[0].message.parsed?.skills;
}
