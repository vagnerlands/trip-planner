import { scrypt, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { z } from "zod";

const scryptAsync = promisify(scrypt);
const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultUsersFile = path.resolve(sourceDirectory, "../../data/users.json");
const usersSchema = z.object({ users: z.array(z.object({ username: z.string(), passwordHash: z.string() })) });

export class UserService {
  constructor(private readonly usersFile = defaultUsersFile) {}

  async verify(username: string, password: string): Promise<boolean> {
    const data = usersSchema.parse(JSON.parse(await readFile(this.usersFile, "utf8")));
    const user = data.users.find((candidate) => candidate.username === username);
    if (!user) return false;
    const [algorithm, salt, expectedHex] = user.passwordHash.split(":");
    if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
    const expected = Buffer.from(expectedHex, "hex");
    const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
