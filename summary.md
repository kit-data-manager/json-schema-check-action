<h1>JSON Schema Check Results</h1>
<h3>Validate JSON Schema</h3>
:white_check_mark: The schema is valid JSON.<h3>Diff to Latest Release</h3>

```diff
-""
+"{\n  \"$id\": \"https://example.com/schemas/template.json\",\n  \"title\": \"My Schema\",\n  \"type\": \"object\",\n  \"properties\": {\n    \"name\": {\n      \"type\": \"string\",\n      \"description\": \"user name\"\n    },\n    \"orcid\": {\n      \"type\": \"string\",\n      \"description\": \"Your ORCiD URL if available.\"\n    },\n    \"image\": {\n      \"type\": \"string\",\n      \"description\": \"An image URL, preferably a picture of you, used later on for result rendering.\"\n    },\n    \"title\": {\n      \"type\": \"string\",\n      \"description\": \"A short title of your feedback (8 - 64 characters) used for result rendering.\",\n      \"minLength\": 8,\n      \"maxLength\": 64\n    },\n    \"rating\": {\n      \"type\": \"integer\",\n      \"description\": \"Workshop rating from 1 to 5\",\n      \"default\": 3,\n      \"minimum\": 1,\n      \"maximum\": 5\n    },\n    \"feedback\": {\n      \"type\": \"string\",\n      \"description\": \"A short feedback on what you liked most/less or on what could be improved.\",\n      \"maxLength\": 512\n    }\n  },\n  \"required\": [\"name\", \"title\", \"rating\"]\n}\n"

```

<h3>Next Steps</h3>
<ul><li>[X] Fix validation errors</li><li>[ ] Check backwards compatibility based on diff</li><li>[ ] React with :thumbsup: to mark the PR as ready</li></ul>
