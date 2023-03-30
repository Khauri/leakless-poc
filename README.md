# Non-serializable values proof of concept

This demonstrates an idea to mark certain properties of objects as private which will make them much harder to accidentally send to the client.

This allows you to fetch a liberal set of data from any source, use them in your middleware, and then pass them through to the response. 
In theory, the properties will automatically be excluded from the response.

## Running

```sh
npm install
npm run dev
```

Open your browser to the url shown. Observe that the log on the server will be different from the log shown in the browser. In the browser the `super_secret_property` is missing, meaning it does not get serialized despite it existing in an object that is intended to be serialized.

## How does it work?

This technique relies on passing the data retrieved from the data source through a schema-based validator/transformer. 
In this repo `zod` is used as it provides a fairly robusts and type-safe interface for validation and transformation.

A `makePrivate` function is used to mark certain fiels in the schema as `private`. This creates a slightly modified version of the object
that more-or-less sets `toJSON` to `undefined` so that when `JSON.stringify` is called on it, it will not show up in the resulting string.

## Major disadvantages

There are quite a lot of disadvantages of this approach that aren't easy to code around. These mostly appear as a limitation of javascript.

1. `typeof [value]` won't work as expected. It will always be `object`. This is very likely to cause hard to debug issues when you're working in type-unsafe code. All objects have a `valueOf` function that can be used to return the underlying value, but it's cumbersome to do this everywhere. This property exists regardless of whether the object is private or not so it's theoretically safe to use on any primitive objects.

2. For the same reason as 1, simple falsey checks `(!value)` do not work as expected because the private object is an object type and by definition all object types are truthy. The workaround would be the same in that you must use the `valueOf` function, but again this may be cumbersome. (Though when compared to alternative approaches it may prove to be the least cumbersome). You can also use coercion like so: `value == false`, but this often conflicts with eslint rules.

3. If you use JSON.stringify to log the object you won't see the value, but `console.dir` and `console.log` will work fine. The logfmt library will also work fine as it internally does not use `JSON.stringify`. It's also possible to provide a custom JSON.stringify function or directly use `util.inspect` to get a value.

4. Private properties will also be omitted if you pass them through to queries that use JSON.stringify without first unwrapping them from their private container. This can be overcome by recursively iterating/using the JSON stringify replacer to unwrap properties (with `valueOf()`) in the database layer.

Overall I'd say that unless these disadvantages can be overcome systematically then this approach is probably going to cause issues. This systematic solution might include enforing a specific coding style and coding rules to minimize the chances of bugs poopping up.

## Advantages

1. You don't need to know the exact shape of the data being serialized beforehand in order to figure out what to omit
2. Automatically hooks into rendering serialization process so there's no need to add custom hooks or modify internal code 
3. With the exception of simple truthyness checks, you can more-or-less use the value as if it were a native primitive/object.

## Variations/Improvements

An idea may be to utilize asynclocalstorage to set context whenever a rendering function is called (res.json or res.marko) such that private properties will know
to return undefined. Otherwise send the property. This will 

Maybe provide an additional function that only modifies object's `toJSON` properties and omits any properties marked as private. This requires the schema storing some kind of context from its parents _and_ has its own disadvantages, namely that when you destructure or pass around a property from an object it will no longer be marked as private.