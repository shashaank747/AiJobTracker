
def interpret_offline(message, context, rules):
    text = normalize(message)

    # 1. Check for exact phrase matches.
    matches = find_phrase_matches(text, rules)

    # 2. Identify negative instructions.
    negation = detect_negation(text)

    # 3. Identify words referring to earlier messages.
    references = resolve_references(text, context)

    # 4. Score possible intents using phrases,
    # keywords, priorities, and conversation context.
    candidates = score_intents(
        text=text,
        matches=matches,
        negation=negation,
        references=references,
        context=context
    )

    # 5. Do not force a decision when evidence is weak.
    if not candidates:
        return {
            "intent": "UNKNOWN_INTENT",
            "confidence": 0.0,
            "clarification_required": True,
            "response": (
                "Could you clarify what you want me to do?"
            )
        }

    best = candidates[0]

    # 6. Ask when ambiguity could cause a wrong action.
    if best["confidence"] < 0.45:
        return clarification_result(candidates, context)

    # 7. Generate an appropriate local response or action.
    return execute_local_rule(best, context)
