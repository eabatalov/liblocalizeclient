## Description

You do not have to care about localizing your site content: the library
loads the most suitable of all available dictionaries and then, when you need a string, 
the library will return it already localized.

## API
### init(defaultLocale, path, callback)

Loads the most suitable dictionary from tha directory specified with `path`, runs `callback` when finished. 
Should be called before the first use of `get` function.

### get(key, dynamicSubstringsDict)

Returns the localized string corresponding to the specified key. Dynamic substrings will be inserted where needed.

## Install

`npm install git+https://git@github.com/LizaTretyakova/liblocalizeclient.git`
