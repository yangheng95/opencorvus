import re


def normalize_duration(value: str) -> int:
    value = value.strip()
    if re.fullmatch(r"[0-9]+", value):
        return int(value)
    if re.fullmatch(r"[0-9]+:[0-9]{2}", value):
        hours, minutes = map(int, value.split(":"))
        if minutes >= 60:
            raise ValueError("MINUTE_OUT_OF_RANGE")
        return hours * 60 + minutes
    raise ValueError("INVALID_DURATION")
