// Most of this code is copied and modified from the OpenTofu Registry UI Repository
// https://github.com/opentofu/registry-ui/blob/main/frontend/src/components/Search/index.tsx

// I used the Google Suggest workflow as a starting point, so some of the code is similar but modified.
// BSD 3-Clause License as of Jan 30, 2025
// Copyright (c) 2022, Running with Crayons Ltd
// All rights reserved.
// https://github.com/alfredapp/google-suggest-workflow/tree/main

const SearchResultType = {
    "Provider": "provider",
    "Module": "module",
    "ProviderResource": "provider/resource",
    "ProviderDatasource": "provider/datasource",
    "ProviderFunction": "provider/function",
    "Other": "other",
}

function getSearchResultType(value) {
    switch (value) {
        case "provider":
            return SearchResultType.Provider;
        case "module":
            return SearchResultType.Module;
        case "provider/resource":
            return SearchResultType.ProviderResource;
        case "provider/datasource":
            return SearchResultType.ProviderDatasource;
        case "provider/function":
            return SearchResultType.ProviderFunction;
        default:
            return SearchResultType.Other;
    }
}

function getSearchResultTypeOrder(type) {
    switch (type) {
        case SearchResultType.Provider:
            return 0;
        case SearchResultType.ProviderResource:
            return 1;
        case SearchResultType.ProviderDatasource:
            return 3
        case SearchResultType.ProviderFunction:
            return 4;
        case SearchResultType.Module:
            return 5;
        default:
            return 6;
    }
}

function getSearchResultTypeLabel(type) {
    switch (type) {
        case SearchResultType.Module:
            return "Module";
        case SearchResultType.ProviderResource:
            return "Resource";
        case SearchResultType.ProviderDatasource:
            return "Datasource";
        case SearchResultType.ProviderFunction:
            return "Function";
        case SearchResultType.Provider:
            return "Provider";
        case SearchResultType.Other:
            return "Other";
    }
}

function getSearchResultTypeLink(type, result) {
    switch (type) {
        case SearchResultType.Module:
            return `https://search.opentofu.org/module/${result.link_variables.namespace}/${result.link_variables.name}/${result.link_variables.target_system}/${result.link_variables.version}`;
        case SearchResultType.Provider:
            return `https://search.opentofu.org/provider/${result.link_variables.namespace}/${result.link_variables.name}/${result.link_variables.version}`;
        case SearchResultType.ProviderResource:
            return `https://search.opentofu.org/provider/${result.link_variables.namespace}/${result.link_variables.name}/${result.link_variables.version}/docs/resources/${result.link_variables.id}`;
        case SearchResultType.ProviderDatasource:
            return `https://search.opentofu.org/provider/${result.link_variables.namespace}/${result.link_variables.name}/${result.link_variables.version}/docs/datasources/${result.link_variables.id}`;
        case SearchResultType.ProviderFunction:
            return `https://search.opentofu.org/provider/${result.link_variables.namespace}/${result.link_variables.name}/${result.link_variables.version}/docs/functions/${result.link_variables.id}`;
        default:
            return "";
    }
}

function getSearchResultDisplayTitle(type, result) {
    switch (type) {
        case SearchResultType.Module:
            return `${result.link_variables.namespace}/${result.link_variables.name}`;
        case SearchResultType.Provider:
            return `${result.link_variables.namespace}/${result.link_variables.name}`;
        case SearchResultType.ProviderResource:
        case SearchResultType.ProviderDatasource:
        case SearchResultType.ProviderFunction:
            return `${result.link_variables.name}_${result.link_variables.id}`;
        default:
            return result.title;
    }
}


function organizeResults(data) {
    const results = [];

    for (let i = 0; i < data.length; i++) {
        if (i >= 10) {
            return results;
        }

        const result = data[i];
        const type = getSearchResultType(result.type);
        const order = getSearchResultTypeOrder(type);
        const link = getSearchResultTypeLink(type, result);
        const displayTitle = getSearchResultDisplayTitle(type, result);

        if (!results[order]) {
            results[order] = {
                type,
                label: getSearchResultTypeLabel(type),
                results: [],
            };
        }

        results[order].results.push({
            id: result.id,
            title: result.title,
            addr: result.addr,
            description: result.description,
            link,
            type,
            displayTitle,
        });
    }

    return results;
}

// Build the list of items to display in alfred
function makeItems(results) {
    if(results === undefined) {
        return [
            {
                "title": "Searching OpenTofu Registry...",
                "valid": false
            }
        ];
    }
    // Parse the results and sort by popularity
    const newResults = organizeResults(JSON.parse(results));

    const returnable = [];
    for (let i = 0; i < newResults.length; i++) {
        const orderResults = newResults[i];
        if (!orderResults) {
            continue;
        }
        for (let j = 0; j < orderResults.results.length; j++) {
            const result = orderResults.results[j];
            returnable.push({
                "uid": result.id,
                "title": orderResults.label + ": " + result.displayTitle,
                "subtitle": result.description,
                "arg": result.link
            })
        }
    }

    return returnable;
}

// Check values from previous runs this session
const oldArg = $.NSProcessInfo.processInfo.environment.objectForKey("oldArg").js
const oldResults = $.NSProcessInfo.processInfo.environment.objectForKey("oldResults").js

// Build items
function run(argv) {
    // If the user is typing, return early to guarantee the top entry is the currently typed query
    // If we waited for the API, a fast typer would search for an incomplete query
    if (argv[0] !== oldArg) {
        return JSON.stringify({
            "rerun": 0.1,
            "skipknowledge": true,
            "variables": { "oldResults": oldResults, "oldArg": argv[0] },
            "items": makeItems(oldResults)
        })
    }

    // Make the API request
    const encodedQuery = encodeURIComponent(argv[0])
    const queryURL = $.NSURL.URLWithString("https://api.opentofu.org/registry/docs/search?q=" + encodedQuery)
    const requestData = $.NSData.dataWithContentsOfURL(queryURL);
    const requestString = $.NSString.alloc.initWithDataEncoding(requestData, $.NSUTF8StringEncoding).js

    // Return final JSON
    return JSON.stringify({
        "skipknowledge": true,
        "variables": { "oldResults": requestString, "oldArg": argv[0] },
        "items": makeItems(requestString)
    })
}