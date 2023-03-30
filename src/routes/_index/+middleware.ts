import * as z from 'zod';
import util from 'util';

interface Private<T> {}
type IsPrivate<T = any> = Private<T> & T;

function makePrivateValue(value: any) {
  // There is no null constructor. Not sure how to handle this yet
  if(value === null) {
    return value;
  }
  const Constructor = value.constructor;
  class PrivateValue extends Constructor {
    // override the default util.inspect.custom method
    [Symbol.for('nodejs.util.inspect.custom')]() {
      // Note that this will not work in the browser. Not 100% sure how to make this work so that schemas with private props can be used in the browser
      const inspect = util.inspect(this.valueOf(), {colors: true});
      return `Private<${inspect}>`;
    }
    [Symbol.toStringTag]() {
      return 'Private';
    }
    // override the default toJSON method
    toJSON() {
      return undefined;
    }
  }
  return Array.isArray(value) ? new PrivateValue(...value) : new PrivateValue(value);
}


function makePrivate<D extends z.ZodTypeDef, T extends z.ZodType<any, D>>(schema: T): z.ZodType<IsPrivate<z.infer<T>>, D> {
  return schema.transform((data) => {
    if(typeof data === 'undefined') {
      return data;
    }
    return makePrivateValue(data);
  }) as unknown as z.ZodType<IsPrivate<z.infer<T>>, D>;
}

const data = {
  name: 'John Doe',
  age: 42,
  super_secret_property: false,
}

const UserSchema = z.object({
  name: z.string(),
  age: z.number(),
  super_secret_property: makePrivate(z.boolean()),
});

class DatabaseQuery<SchemaType = any> implements PromiseLike<any> {
  fileName: string;

  params: Record<string, any>;

  schema?: SchemaType;

  constructor(fileName: string, params: Record<string, any>, schema?: SchemaType) {
    this.fileName = fileName;
    this.params = params;
    this.schema = schema;
  }
  
  then<TResult1 = any, TResult2 = never> (
    onfulfilled?: ((value: SchemaType extends z.ZodType<any, any, any> ? z.infer<SchemaType> : SchemaType) => TResult1 | PromiseLike<TResult1>) | null | undefined, 
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ): PromiseLike<TResult1 | TResult2> {
    return this.fetch().then(onfulfilled, onrejected);
  }

  into<SchemaType>(schema: SchemaType): DatabaseQuery<SchemaType> {
    return new DatabaseQuery<SchemaType>(this.fileName, this.params, schema);
  }

  async fetch(): Promise<any> {
    // Use the database connection to fetch actual data here
    const result = await data;
    if(this.schema && this.schema instanceof z.ZodType) {
      return this.schema.parse(result);
    }
    return result;
  }
}

// Simulates a database driver
const db = {
  file(fileName: string, params: Record<string, any> = {}): DatabaseQuery {
    return new DatabaseQuery(fileName, params);
  }
}

// Main shit
export default async function(context, next) {
  const result = await db.file('db/fake/file.sql').into(UserSchema);
  context.test = result; 
  console.log(result.super_secret_property == false);
  context.serializedGlobals.test = true;
  return await next(); // Wait for subsequent middleware, handler, and page
}